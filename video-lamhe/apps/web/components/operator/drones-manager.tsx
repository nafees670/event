'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { ManagedOperator, OperatorDroneOffer, PublicDroneModel } from '@video-lamhe/shared';
import { Button, Card, CardContent, Input, Select, Switch } from '@/components/ui';
import { ApiError } from '@/lib/api/client';
import { myOperator } from '@/lib/api/catalog-client';

const toNum = (v: string) => (v.trim() === '' ? undefined : Number(v));
const valid = (v: string) => v.trim() === '' || (/^\d+$/.test(v.trim()) && Number(v) <= 10_000_000);

function OfferRow({
  offer,
  onSaved,
}: {
  offer: OperatorDroneOffer;
  onSaved: (op: ManagedOperator) => void;
}) {
  const [event, setEvent] = useState(offer.pricePerEvent?.toString() ?? '');
  const [hour, setHour] = useState(offer.pricePerHour?.toString() ?? '');
  const [available, setAvailable] = useState(offer.isAvailable);
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null);
  const dirty =
    event !== (offer.pricePerEvent?.toString() ?? '') ||
    hour !== (offer.pricePerHour?.toString() ?? '') ||
    available !== offer.isAvailable;

  const run = async (kind: 'save' | 'remove') => {
    setBusy(kind);
    try {
      const op =
        kind === 'save'
          ? await myOperator.updateDrone(offer.id, {
              pricePerEvent: toNum(event) ?? null,
              pricePerHour: toNum(hour) ?? null,
              isAvailable: available,
            })
          : await myOperator.removeDrone(offer.id);
      onSaved(op);
      toast.success(kind === 'save' ? 'Saved' : `${offer.model.name} removed`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save. Try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-2xl">{offer.model.name}</h3>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remove ${offer.model.name}`}
            loading={busy === 'remove'}
            onClick={() => run('remove')}
          >
            {busy !== 'remove' && <Trash2 aria-hidden="true" />}
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Price per event (PKR)"
            inputMode="numeric"
            value={event}
            onChange={(e) => setEvent(e.target.value)}
            error={valid(event) ? undefined : 'Whole rupees only'}
          />
          <Input
            label="Price per hour (PKR)"
            inputMode="numeric"
            value={hour}
            onChange={(e) => setHour(e.target.value)}
            error={valid(hour) ? undefined : 'Whole rupees only'}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Switch
            checked={available}
            onCheckedChange={setAvailable}
            label="Available for bookings"
          />
          <Button
            size="sm"
            disabled={!dirty || !valid(event) || !valid(hour)}
            loading={busy === 'save'}
            onClick={() => run('save')}
          >
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function DronesManager({
  operator,
  models,
  onChange,
}: {
  operator: ManagedOperator;
  models: PublicDroneModel[];
  onChange: (op: ManagedOperator) => void;
}) {
  const listed = new Set(operator.drones.map((d) => d.model.id));
  const available = models.filter((m) => !listed.has(m.id));
  const [model, setModel] = useState('');
  const [price, setPrice] = useState('');
  const [adding, setAdding] = useState(false);

  const add = async () => {
    setAdding(true);
    try {
      onChange(await myOperator.addDrone({ model, pricePerEvent: toNum(price) }));
      setModel('');
      setPrice('');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not add the drone.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {operator.drones.length === 0 && (
        <p className="text-sm text-muted">
          Add the drones you fly so couples can find you by drone and budget.
        </p>
      )}
      {operator.drones.map((d) => (
        // key includes values so the row resets after a save from elsewhere
        <OfferRow
          key={`${d.id}-${d.pricePerEvent}-${d.pricePerHour}-${d.isAvailable}`}
          offer={d}
          onSaved={onChange}
        />
      ))}
      {available.length > 0 && (
        <Card className="border-dashed">
          <CardContent className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Select
              label="Add a drone"
              placeholder="Choose model"
              options={available.map((m) => ({ value: m.id, label: m.name }))}
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
            <Input
              label="Price per event (PKR)"
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              error={valid(price) ? undefined : 'Whole rupees only'}
            />
            <Button onClick={add} disabled={!model || !valid(price)} loading={adding}>
              {!adding && <Plus aria-hidden="true" />} Add
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
