import { Types, type SortOrder } from 'mongoose';
import type {
  AdminCity,
  AdminDroneModel,
  CityRef,
  DroneDetail,
  DroneModelRef,
  DroneSort,
  EventType,
  ManagedOperator,
  OperatorDroneOffer,
  OperatorSort,
  PageMeta,
  PublicCity,
  PublicDroneModel,
  PublicOperator,
  PublicOperatorCard,
} from '@video-lamhe/shared';
import { AppError } from '../lib/errors.js';
import { escapeRegex } from '../lib/slug.js';
import { City } from '../models/City.js';
import { DroneModel } from '../models/DroneModel.js';
import { NO_PRICE_SORT, Operator } from '../models/Operator.js';
import { OperatorDrone } from '../models/OperatorDrone.js';
import { Short } from '../models/Short.js';

// ---------- lean document shapes ----------

interface LeanCity {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  province: string;
  isActive: boolean;
}

interface LeanDroneModel {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  tag?: string | null;
  bestFor?: string | null;
  specs?: { camera?: string; video?: string; flightTime?: string; range?: string };
  images?: string[];
  sortOrder?: number;
}

interface LeanOperator {
  _id: Types.ObjectId;
  slug: string;
  businessName: string;
  bio?: string | null;
  photoUrl?: string | null;
  baseCity: LeanCity;
  serviceCities: LeanCity[];
  phone?: string;
  whatsapp?: string;
  experienceYears?: number;
  rating?: number;
  reviewCount?: number;
  status: 'pending' | 'active' | 'inactive';
  isVerified?: boolean;
  socialLinks?: Record<string, string | undefined>;
  priceFrom?: number | null;
  createdAt: Date;
  user?: { _id: Types.ObjectId; name: string; email: string } | Types.ObjectId;
}

interface LeanOffer {
  _id: Types.ObjectId;
  operator: Types.ObjectId;
  model: LeanDroneModel;
  pricePerEvent?: number | null;
  pricePerHour?: number | null;
  isAvailable: boolean;
}

/** Public projection: the phone number is never even loaded. */
const PUBLIC_OPERATOR_FIELDS = '-phone';
const CITY_FIELDS = 'name slug province isActive';
const MODEL_REF_FIELDS = 'name slug tag sortOrder';

// ---------- serializers ----------

export const cityRef = (c: LeanCity): CityRef => ({
  id: String(c._id),
  name: c.name,
  slug: c.slug,
});

export const droneRef = (m: LeanDroneModel): DroneModelRef => ({
  id: String(m._id),
  name: m.name,
  slug: m.slug,
  tag: m.tag ?? null,
});

function toOffer(o: LeanOffer): OperatorDroneOffer {
  return {
    id: String(o._id),
    model: droneRef(o.model),
    pricePerEvent: o.pricePerEvent ?? null,
    pricePerHour: o.pricePerHour ?? null,
    isAvailable: o.isAvailable,
  };
}

function toCard(op: LeanOperator, offers: OperatorDroneOffer[]): PublicOperatorCard {
  return {
    id: String(op._id),
    slug: op.slug,
    businessName: op.businessName,
    photoUrl: op.photoUrl ?? null,
    baseCity: cityRef(op.baseCity),
    serviceCities: (op.serviceCities ?? []).filter((c) => c.isActive).map(cityRef),
    experienceYears: op.experienceYears ?? 0,
    rating: op.rating ?? 0,
    reviewCount: op.reviewCount ?? 0,
    isVerified: op.isVerified ?? false,
    hasWhatsapp: Boolean(op.whatsapp),
    priceFrom: op.priceFrom ?? null,
    drones: offers,
  };
}

function cleanLinks(links: LeanOperator['socialLinks']) {
  return Object.fromEntries(Object.entries(links ?? {}).filter(([, v]) => Boolean(v)));
}

function toPublic(op: LeanOperator, offers: OperatorDroneOffer[]): PublicOperator {
  return {
    ...toCard(op, offers),
    bio: op.bio ?? null,
    socialLinks: cleanLinks(op.socialLinks),
    memberSince: op.createdAt.toISOString(),
  };
}

function toManaged(op: LeanOperator, offers: OperatorDroneOffer[]): ManagedOperator {
  const owner =
    op.user && 'email' in op.user
      ? { id: String(op.user._id), name: op.user.name, email: op.user.email }
      : { id: String(op.user ?? ''), name: '', email: '' };
  return {
    ...toPublic(op, offers),
    // Managed views list every service city (incl. inactive) so admins can see them.
    serviceCities: (op.serviceCities ?? []).map(cityRef),
    status: op.status,
    phone: op.phone ?? '',
    whatsapp: op.whatsapp ?? '',
    owner,
    createdAt: op.createdAt.toISOString(),
  };
}

// ---------- helpers ----------

/** Offers grouped by operator id, ordered like the drone selector. */
async function loadOffers(
  operatorIds: Types.ObjectId[],
  opts: { availableOnly: boolean },
): Promise<Map<string, OperatorDroneOffer[]>> {
  const rows = (await OperatorDrone.find({
    operator: { $in: operatorIds },
    ...(opts.availableOnly ? { isAvailable: true } : {}),
  })
    .populate('model', MODEL_REF_FIELDS)
    .lean()) as unknown as LeanOffer[];

  const map = new Map<string, OperatorDroneOffer[]>();
  rows
    .filter((r) => r.model) // model deleted → skip
    .sort((a, b) => (a.model.sortOrder ?? 0) - (b.model.sortOrder ?? 0))
    .forEach((r) => {
      const key = String(r.operator);
      map.set(key, [...(map.get(key) ?? []), toOffer(r)]);
    });
  return map;
}

function populateOperator<T>(query: T): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mongoose query chaining
  return (query as any)
    .populate('baseCity', CITY_FIELDS)
    .populate('serviceCities', CITY_FIELDS) as T;
}

async function activeCityBySlug(slug: string) {
  return City.findOne({ slug, isActive: true }).lean<LeanCity>();
}

const cityMatch = (cityId: Types.ObjectId) => ({
  $or: [{ baseCity: cityId }, { serviceCities: cityId }],
});

/** Throws 400 if any id doesn't exist. Returns de-duplicated ObjectIds. */
export async function assertCitiesExist(ids: string[]): Promise<Types.ObjectId[]> {
  const unique = [...new Set(ids)];
  const found = await City.countDocuments({ _id: { $in: unique } });
  if (found !== unique.length) throw new AppError(400, 'INVALID_REFERENCE', 'Unknown city');
  return unique.map((id) => new Types.ObjectId(id));
}

export async function assertDroneModelsExist(ids: string[]): Promise<void> {
  const unique = [...new Set(ids)];
  if (unique.length !== ids.length) {
    throw new AppError(400, 'DUPLICATE_DRONE', 'Each drone model can only be added once');
  }
  const found = await DroneModel.countDocuments({ _id: { $in: unique } });
  if (found !== unique.length) throw new AppError(400, 'INVALID_REFERENCE', 'Unknown drone model');
}

/** Keeps Operator.priceFrom/priceSort in sync with its available, priced drones. */
export async function recomputePriceFrom(operatorId: Types.ObjectId | string): Promise<void> {
  const [row] = await OperatorDrone.aggregate<{ min: number | null }>([
    { $match: { operator: new Types.ObjectId(String(operatorId)), isAvailable: true } },
    { $group: { _id: null, min: { $min: '$pricePerEvent' } } }, // $min ignores nulls
  ]);
  const min = row?.min ?? null;
  await Operator.updateOne(
    { _id: operatorId },
    { priceFrom: min, priceSort: min ?? NO_PRICE_SORT },
  );
}

// ---------- cities ----------

async function cityOperatorCounts(): Promise<Map<string, number>> {
  const rows = await Operator.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { status: 'active' } },
    { $project: { cities: { $setUnion: [['$baseCity'], '$serviceCities'] } } },
    { $unwind: '$cities' },
    { $group: { _id: '$cities', n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

export async function listCities(opts: { includeInactive: boolean }): Promise<AdminCity[]> {
  const [cities, counts] = await Promise.all([
    City.find(opts.includeInactive ? {} : { isActive: true })
      .sort({ name: 1 })
      .lean<LeanCity[]>(),
    cityOperatorCounts(),
  ]);
  return cities.map((c) => ({
    ...cityRef(c),
    province: c.province,
    isActive: c.isActive,
    operatorCount: counts.get(String(c._id)) ?? 0,
  }));
}

export async function getPublicCity(slug: string): Promise<PublicCity> {
  const city = await activeCityBySlug(slug);
  if (!city) throw AppError.notFound('City not found');
  const counts = await cityOperatorCounts();
  return {
    ...cityRef(city),
    province: city.province,
    operatorCount: counts.get(String(city._id)) ?? 0,
  };
}

// ---------- operators (public) ----------

const OPERATOR_SORT: Record<OperatorSort, Record<string, SortOrder>> = {
  recommended: { isVerified: -1, rating: -1, reviewCount: -1, _id: -1 },
  rating: { rating: -1, reviewCount: -1, _id: -1 },
  price_asc: { priceSort: 1, _id: 1 },
  price_desc: { priceFrom: -1, _id: -1 },
  experience: { experienceYears: -1, _id: -1 },
};

export interface PublicOperatorQuery {
  city?: string;
  drone?: string;
  event?: EventType;
  q?: string;
  sort: OperatorSort;
  page: number;
  limit: number;
}

const emptyPage = (page: number, limit: number) => ({
  items: [] as PublicOperatorCard[],
  meta: { page, limit, total: 0, pages: 0 } satisfies PageMeta,
});

export async function listPublicOperators(query: PublicOperatorQuery) {
  const { page, limit } = query;
  const filter: Record<string, unknown> = { status: 'active' };

  if (query.city) {
    const city = await activeCityBySlug(query.city);
    if (!city) return emptyPage(page, limit);
    Object.assign(filter, cityMatch(city._id));
  }
  if (query.drone) {
    const model = await DroneModel.findOne({ slug: query.drone }).select('_id').lean();
    if (!model) return emptyPage(page, limit);
    filter._id = {
      $in: await OperatorDrone.distinct('operator', { model: model._id, isAvailable: true }),
    };
  }
  if (query.event) {
    // Operators with published shorts of this event (intersected with the drone filter).
    const withEvent = await operatorIdsWithEvent(query.event);
    const current = (filter._id as { $in: Types.ObjectId[] } | undefined)?.$in;
    filter._id = { $in: current ? intersectIds(current, withEvent) : withEvent };
  }

  // Complete the filter BEFORE building the query — Operator.find() copies it at call time.
  if (query.q) filter.$text = { $search: query.q };
  const rankByText = Boolean(query.q) && query.sort === 'recommended';

  let sort: Record<string, SortOrder | { $meta: 'textScore' }> = OPERATOR_SORT[query.sort];
  const find = Operator.find(filter).select(PUBLIC_OPERATOR_FIELDS);
  if (rankByText) {
    // Best text match first, then the usual ranking.
    sort = { score: { $meta: 'textScore' }, ...sort };
    find.select({ score: { $meta: 'textScore' } });
  }

  const [total, ops] = await Promise.all([
    Operator.countDocuments(filter),
    populateOperator(
      find
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit),
    ).lean<LeanOperator[]>(),
  ]);
  const offers = await loadOffers(
    ops.map((o) => o._id),
    { availableOnly: true },
  );
  return {
    items: ops.map((o) => toCard(o, offers.get(String(o._id)) ?? [])),
    meta: { page, limit, total, pages: Math.ceil(total / limit) } satisfies PageMeta,
  };
}

export async function getPublicOperator(slug: string): Promise<PublicOperator> {
  const op = await populateOperator(
    Operator.findOne({ slug, status: 'active' }).select(PUBLIC_OPERATOR_FIELDS),
  ).lean<LeanOperator>();
  if (!op) throw AppError.notFound('Operator not found');
  const offers = await loadOffers([op._id], { availableOnly: true });
  return toPublic(op, offers.get(String(op._id)) ?? []);
}

/** For contact endpoints: active operator incl. private numbers. */
export async function getActiveOperatorContact(slug: string) {
  const op = await Operator.findOne({ slug, status: 'active' })
    .select('businessName phone whatsapp baseCity')
    .populate('baseCity', 'name')
    .lean<{
      _id: Types.ObjectId;
      businessName: string;
      phone: string;
      whatsapp: string;
      baseCity: { name: string };
    }>();
  if (!op) throw AppError.notFound('Operator not found');
  return op;
}

// ---------- operators (managed: admin + own profile) ----------

export async function getManagedOperator(filter: {
  _id?: unknown;
  user?: unknown;
}): Promise<ManagedOperator> {
  const op = await populateOperator(
    Operator.findOne(filter).populate('user', 'name email'),
  ).lean<LeanOperator>();
  if (!op) throw AppError.notFound('Operator not found');
  const offers = await loadOffers([op._id], { availableOnly: false });
  return toManaged(op, offers.get(String(op._id)) ?? []);
}

export async function listManagedOperators(query: {
  city?: string;
  status?: string;
  q?: string;
  page: number;
  limit: number;
}) {
  const { page, limit } = query;
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.city) Object.assign(filter, cityMatch(new Types.ObjectId(query.city)));
  if (query.q) filter.businessName = { $regex: escapeRegex(query.q), $options: 'i' };

  const [total, ops] = await Promise.all([
    Operator.countDocuments(filter),
    populateOperator(
      Operator.find(filter)
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ).lean<LeanOperator[]>(),
  ]);
  const offers = await loadOffers(
    ops.map((o) => o._id),
    { availableOnly: false },
  );
  return {
    items: ops.map((o) => toManaged(o, offers.get(String(o._id)) ?? [])),
    meta: { page, limit, total, pages: Math.ceil(total / limit) } satisfies PageMeta,
  };
}

// ---------- drones ----------

function toDroneModel(
  m: LeanDroneModel,
  stats?: { priceFrom: number | null; operatorCount: number },
): AdminDroneModel {
  return {
    ...droneRef(m),
    bestFor: m.bestFor ?? null,
    specs: {
      camera: m.specs?.camera ?? '',
      video: m.specs?.video ?? '',
      flightTime: m.specs?.flightTime ?? '',
      range: m.specs?.range ?? '',
    },
    images: m.images ?? [],
    sortOrder: m.sortOrder ?? 0,
    priceFrom: stats?.priceFrom ?? null,
    operatorCount: stats?.operatorCount ?? 0,
  };
}

/** Active operator ids, optionally limited to a city (null = city filter matched nothing). */
async function activeOperatorIds(
  citySlug?: string,
  event?: EventType,
): Promise<Types.ObjectId[] | null> {
  const filter: Record<string, unknown> = { status: 'active' };
  if (citySlug) {
    const city = await activeCityBySlug(citySlug);
    if (!city) return null;
    Object.assign(filter, cityMatch(city._id));
  }
  if (event) filter._id = { $in: await operatorIdsWithEvent(event) };
  return (await Operator.find(filter).select('_id').lean()).map((o) => o._id);
}

/** Operators that have published shorts of an event (powers the "event" filters). */
export const operatorIdsWithEvent = (event: EventType) =>
  Short.distinct('operator', {
    status: 'published',
    operatorActive: true,
    eventType: event,
  }) as Promise<Types.ObjectId[]>;

function intersectIds(a: Types.ObjectId[], b: Types.ObjectId[]) {
  const keep = new Set(b.map(String));
  return a.filter((id) => keep.has(String(id)));
}

const priceKey = (v: number | null, dir: 1 | -1) => (v === null ? Infinity : dir * v);

export async function listDroneModels(query: {
  city?: string;
  event?: EventType;
  maxPrice?: number;
  sort: DroneSort;
}): Promise<AdminDroneModel[]> {
  const opIds = (await activeOperatorIds(query.city, query.event)) ?? [];
  const match: Record<string, unknown> = { operator: { $in: opIds }, isAvailable: true };
  if (query.maxPrice !== undefined) match.pricePerEvent = { $lte: query.maxPrice };

  const [models, stats] = await Promise.all([
    DroneModel.find().sort({ sortOrder: 1, name: 1 }).lean<LeanDroneModel[]>(),
    OperatorDrone.aggregate<{
      _id: Types.ObjectId;
      operatorCount: number;
      priceFrom: number | null;
    }>([
      { $match: match },
      {
        $group: {
          _id: '$model',
          operatorCount: { $sum: 1 },
          priceFrom: { $min: '$pricePerEvent' },
        },
      },
    ]),
  ]);
  const byModel = new Map(stats.map((s) => [String(s._id), s]));
  let items = models.map((m) => toDroneModel(m, byModel.get(String(m._id))));

  // With a filter, only show drones actually bookable under it.
  if (query.city || query.event || query.maxPrice !== undefined) {
    items = items.filter((m) => m.operatorCount > 0);
  }

  const sorters: Record<DroneSort, (a: AdminDroneModel, b: AdminDroneModel) => number> = {
    popular: (a, b) => b.operatorCount - a.operatorCount || a.sortOrder - b.sortOrder,
    price_asc: (a, b) => priceKey(a.priceFrom, 1) - priceKey(b.priceFrom, 1),
    price_desc: (a, b) => priceKey(a.priceFrom, -1) - priceKey(b.priceFrom, -1),
    name: (a, b) => a.name.localeCompare(b.name),
  };
  return items.sort(sorters[query.sort]);
}

/** Every model (no filter → none are hidden), in selector order. */
export async function listAllDroneModels(): Promise<AdminDroneModel[]> {
  const items = await listDroneModels({ sort: 'name' });
  return items.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export async function getDroneDetail(slug: string, citySlug?: string): Promise<DroneDetail> {
  const model = await DroneModel.findOne({ slug }).lean<LeanDroneModel>();
  if (!model) throw AppError.notFound('Drone not found');

  const opIds = (await activeOperatorIds(citySlug)) ?? [];
  const rows = (await OperatorDrone.find({
    model: model._id,
    isAvailable: true,
    operator: { $in: opIds },
  })
    .populate('model', MODEL_REF_FIELDS)
    .lean()) as unknown as LeanOffer[];

  const ops = await populateOperator(
    Operator.find({ _id: { $in: rows.map((r) => r.operator) } }).select(PUBLIC_OPERATOR_FIELDS),
  ).lean<LeanOperator[]>();
  const allOffers = await loadOffers(
    ops.map((o) => o._id),
    { availableOnly: true },
  );
  const opById = new Map(ops.map((o) => [String(o._id), o]));

  const offers = rows
    .filter((r) => opById.has(String(r.operator)))
    .map((r) => {
      const op = opById.get(String(r.operator))!;
      return { ...toCard(op, allOffers.get(String(op._id)) ?? []), offer: toOffer(r) };
    })
    .sort((a, b) => priceKey(a.offer.pricePerEvent, 1) - priceKey(b.offer.pricePerEvent, 1));

  const prices = offers.map((o) => o.offer.pricePerEvent).filter((p): p is number => p !== null);
  const { sortOrder: _s, ...publicModel } = toDroneModel(model, {
    priceFrom: prices.length ? Math.min(...prices) : null,
    operatorCount: offers.length,
  });
  return { model: publicModel as PublicDroneModel, offers };
}
