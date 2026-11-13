'use client';

import type { AdminDroneModel, OperatorDroneInput, OperatorDroneOffer } from '@video-lamhe/shared';
import { Chip, Input, Switch } from '@/components/ui';

export interface DroneRow {
  enabled: boolean;
  pricePerEvent: string;
  pricePerHour: string;
  isAvailable: boolean;
}
export type DroneRows = Record<string, DroneRow>;

export const isPrice = (v: string) =>
  v.trim() === '' || (/^\d+$/.test(v.trim()) && Number(v) <= 10_000_000);

export function rowsFromOffers(offers: OperatorDroneOffer[]): DroneRows {
  return Object.fromEntries(
    offers.map((o) => [
      o.model.id,
      {
        enabled: true,
        pricePerEvent: o.pricePerEvent?.toString() ?? '',
        pricePerHour: o.pricePerHour?.toString() ?? '',
        isAvailable: o.isAvailable,
      },
    ]),
  );
}

export function rowsToInput(rows: DroneRows): OperatorDroneInput[] {
  return Object.entries(rows)
    .filter(([, r]) => r.enabled)
    .map(([model, r]) => ({
      model,
      pricePerEvent: r.pricePerEvent.trim() ? Number(r.pricePerEvent) : undefined,
      pricePerHour: r.pricePerHour.trim() ? Number(r.pricePerHour) : undefined,
      isAvailable: r.isAvailable,
    }));
}

export const rowsValid = (rows: DroneRows) =>
  Object.values(rows).every(
    (r) => !r.enabled || (isPrice(r.pricePerEvent) && isPrice(r.pricePerHour)),
  );

/** One row per drone model: does this operator fly it, and at what price. */
export function DronePricing({
  models,
  rows,
  onChange,
}: {
  models: AdminDroneModel[];
  rows: DroneRows;
  onChange: (rows: DroneRows) => void;
}) {
  const set = (id: string, patch: Partial<DroneRow>) => {
    const current = rows[id] ?? {
      enabled: false,
      pricePerEvent: '',
      pricePerHour: '',
      isAvailable: true,
    };
    onChange({ ...rows, [id]: { ...current, ...patch } });
  };
  return (
    <div className="flex flex-col gap-3">
      {models.map((m) => {
        const r = rows[m.id];
        const on = r?.enabled ?? false;
        return (
          <div key={m.id} className="flex flex-col gap-3 rounded-media border border-line p-4">
            <Chip selected={on} className="self-start" onClick={() => set(m.id, { enabled: !on })}>
              {m.name}
            </Chip>
            {on && r && (
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <Input
                  label="Per event (PKR)"
                  inputMode="numeric"
                  value={r.pricePerEvent}
                  onChange={(e) => set(m.id, { pricePerEvent: e.target.value })}
                  error={isPrice(r.pricePerEvent) ? undefined : 'Whole rupees'}
                />
                <Input
                  label="Per hour (PKR)"
                  inputMode="numeric"
                  value={r.pricePerHour}
                  onChange={(e) => set(m.id, { pricePerHour: e.target.value })}
                  error={isPrice(r.pricePerHour) ? undefined : 'Whole rupees'}
                />
                <Switch
                  checked={r.isAvailable}
                  onCheckedChange={(v) => set(m.id, { isAvailable: v })}
                  label="Available"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
