import { Types } from 'mongoose';
import type { Logger } from 'pino';
import {
  MEDIA_LIMITS,
  type EventType,
  type ManagedShort,
  type PageMeta,
  type PublicShort,
  type ShortEngagement,
  type ShortStatus,
} from '@video-lamhe/shared';
import { AppError } from '../lib/errors.js';
import {
  destroyLater,
  folderFor,
  shortThumbnailUrl,
  shortVideoUrl,
  type MediaService,
} from '../lib/media.js';
import { City } from '../models/City.js';
import { DroneModel } from '../models/DroneModel.js';
import { Operator } from '../models/Operator.js';
import { Short } from '../models/Short.js';
import { SavedShort, ShortLike } from '../models/ShortEngagement.js';
import { assertCitiesExist, assertDroneModelsExist } from './catalog.js';

// ---------- serializers ----------

interface LeanShort {
  _id: Types.ObjectId;
  title: string;
  caption?: string | null;
  eventType: EventType;
  videoUrl: string;
  thumbnailUrl: string;
  durationSec?: number;
  likeCount?: number;
  views?: number;
  isFeatured?: boolean;
  status: ShortStatus;
  rejectionReason?: string | null;
  operatorActive?: boolean;
  createdAt: Date;
  operator: {
    _id: Types.ObjectId;
    slug: string;
    businessName: string;
    photoUrl?: string | null;
    isVerified?: boolean;
  } | null;
  city: { _id: Types.ObjectId; name: string; slug: string } | null;
  droneModel: { _id: Types.ObjectId; name: string; slug: string; tag?: string | null } | null;
}

const populateShort = <T>(q: T): T =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mongoose query chaining
  (q as any)
    .populate('operator', 'slug businessName photoUrl isVerified') // never phone/whatsapp
    .populate('city', 'name slug')
    .populate('droneModel', 'name slug tag') as T;

function toPublicShort(s: LeanShort): PublicShort {
  return {
    id: String(s._id),
    title: s.title,
    caption: s.caption ?? null,
    eventType: s.eventType,
    videoUrl: s.videoUrl,
    thumbnailUrl: s.thumbnailUrl,
    durationSec: s.durationSec ?? 0,
    likeCount: s.likeCount ?? 0,
    views: s.views ?? 0,
    isFeatured: s.isFeatured ?? false,
    operator: {
      id: String(s.operator?._id ?? ''),
      slug: s.operator?.slug ?? '',
      businessName: s.operator?.businessName ?? '',
      photoUrl: s.operator?.photoUrl ?? null,
      isVerified: s.operator?.isVerified ?? false,
    },
    city: { id: String(s.city?._id ?? ''), name: s.city?.name ?? '', slug: s.city?.slug ?? '' },
    droneModel: s.droneModel
      ? {
          id: String(s.droneModel._id),
          name: s.droneModel.name,
          slug: s.droneModel.slug,
          tag: s.droneModel.tag ?? null,
        }
      : null,
    createdAt: s.createdAt.toISOString(),
  };
}

const toManagedShort = (s: LeanShort): ManagedShort => ({
  ...toPublicShort(s),
  status: s.status,
  rejectionReason: s.rejectionReason ?? null,
  operatorInactive: s.operatorActive === false,
});

// ---------- cursor ----------

/** Opaque cursor: base64url('<createdAtMs>_<id>'). Stable with the (createdAt, _id) sort. */
export const encodeCursor = (s: { createdAt: Date; _id: Types.ObjectId }) =>
  Buffer.from(`${s.createdAt.getTime()}_${String(s._id)}`).toString('base64url');

export function decodeCursor(cursor: string): { at: Date; id: Types.ObjectId } {
  const raw = Buffer.from(cursor, 'base64url').toString('utf8');
  const m = /^(\d{10,16})_([a-f\d]{24})$/i.exec(raw);
  if (!m) throw new AppError(400, 'INVALID_CURSOR', 'Invalid cursor');
  return { at: new Date(Number(m[1])), id: new Types.ObjectId(m[2]) };
}

// ---------- public feed ----------

export interface FeedQuery {
  cursor?: string;
  city?: string;
  event?: EventType;
  drone?: string;
  operator?: string;
  featured?: boolean;
  limit: number;
}

export const PUBLIC_SHORT_FILTER = { status: 'published', operatorActive: true } as const;

export async function listFeed(
  q: FeedQuery,
): Promise<{ items: PublicShort[]; nextCursor: string | null }> {
  const empty = { items: [], nextCursor: null };
  const filter: Record<string, unknown> = { ...PUBLIC_SHORT_FILTER };

  if (q.city) {
    const city = await City.findOne({ slug: q.city, isActive: true }).select('_id').lean();
    if (!city) return empty;
    filter.city = city._id;
  }
  if (q.drone) {
    const model = await DroneModel.findOne({ slug: q.drone }).select('_id').lean();
    if (!model) return empty;
    filter.droneModel = model._id;
  }
  if (q.operator) {
    const op = await Operator.findOne({ slug: q.operator, status: 'active' }).select('_id').lean();
    if (!op) return empty;
    filter.operator = op._id;
  }
  if (q.event) filter.eventType = q.event;
  if (q.featured) filter.isFeatured = true;
  if (q.cursor) {
    const { at, id } = decodeCursor(q.cursor);
    filter.$or = [{ createdAt: { $lt: at } }, { createdAt: at, _id: { $lt: id } }];
  }

  const rows = await populateShort(
    Short.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(q.limit + 1),
  ).lean<LeanShort[]>();
  const page = rows.slice(0, q.limit);
  const last = page[page.length - 1];
  return {
    items: page.map(toPublicShort),
    nextCursor: rows.length > q.limit && last ? encodeCursor(last) : null,
  };
}

export async function getPublicShort(id: string): Promise<PublicShort> {
  const s = await populateShort(
    Short.findOne({ _id: id, ...PUBLIC_SHORT_FILTER }),
  ).lean<LeanShort>();
  if (!s) throw AppError.notFound('Short not found');
  return toPublicShort(s);
}

// ---------- engagement ----------

async function assertPublic(id: string) {
  if (!(await Short.exists({ _id: id, ...PUBLIC_SHORT_FILTER })))
    throw AppError.notFound('Short not found');
}

export async function engagementFor(userId: string, ids: string[]): Promise<ShortEngagement> {
  const [likes, saves] = await Promise.all([
    ShortLike.find({ user: userId, short: { $in: ids } })
      .select('short')
      .lean(),
    SavedShort.find({ user: userId, short: { $in: ids } })
      .select('short')
      .lean(),
  ]);
  return { liked: likes.map((l) => String(l.short)), saved: saves.map((s) => String(s.short)) };
}

/** Idempotent: only a newly created like row bumps the counter. */
export async function setLike(id: string, userId: string, liked: boolean) {
  await assertPublic(id);
  if (liked) {
    const r = await ShortLike.updateOne(
      { short: id, user: userId },
      { $setOnInsert: { short: id, user: userId } },
      { upsert: true },
    );
    if (r.upsertedCount) await Short.updateOne({ _id: id }, { $inc: { likeCount: 1 } });
  } else {
    const r = await ShortLike.deleteOne({ short: id, user: userId });
    if (r.deletedCount)
      await Short.updateOne({ _id: id, likeCount: { $gt: 0 } }, { $inc: { likeCount: -1 } });
  }
  const s = await Short.findById(id).select('likeCount').lean();
  return { liked, likeCount: s?.likeCount ?? 0 };
}

export async function setSaved(id: string, userId: string, saved: boolean) {
  await assertPublic(id);
  if (saved) {
    await SavedShort.updateOne(
      { short: id, user: userId },
      { $setOnInsert: { short: id, user: userId } },
      { upsert: true },
    );
  } else {
    await SavedShort.deleteOne({ short: id, user: userId });
  }
  return { saved };
}

export async function listSaved(userId: string): Promise<PublicShort[]> {
  const rows = await SavedShort.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(48)
    .select('short')
    .lean();
  const shorts = await populateShort(
    Short.find({ _id: { $in: rows.map((r) => r.short) }, ...PUBLIC_SHORT_FILTER }),
  ).lean<LeanShort[]>();
  const byId = new Map(shorts.map((s) => [String(s._id), s]));
  // keep "most recently saved first"
  return rows
    .map((r) => byId.get(String(r.short)))
    .filter((s): s is LeanShort => Boolean(s))
    .map(toPublicShort);
}

/** Views: a plain counter for now (Phase 8: Redis INCR + periodic flush). */
export async function recordView(id: string) {
  await Short.updateOne({ _id: id, ...PUBLIC_SHORT_FILTER }, { $inc: { views: 1 } });
}

// ---------- managed (operator / admin) ----------

export interface ShortMeta {
  title: string;
  caption?: string;
  city: string;
  droneModel?: string;
  eventType: EventType;
}

async function assertMetaRefs(meta: Partial<ShortMeta>) {
  if (meta.city) await assertCitiesExist([meta.city]);
  if (meta.droneModel) await assertDroneModelsExist([meta.droneModel]);
}

/**
 * Turns a browser-side Cloudinary upload into a Short — after checking with Cloudinary itself
 * that the file exists, is in the uploader's own folder and respects the 60 s / 100 MB limits.
 */
export async function createShortFromUpload(opts: {
  media: MediaService;
  logger: Logger;
  uploaderId: string;
  operatorId: Types.ObjectId | string;
  publicId: string;
  meta: ShortMeta;
  status: ShortStatus;
  isFeatured?: boolean;
}) {
  const { media, publicId } = opts;
  if (!publicId.startsWith(`${folderFor('short', opts.uploaderId)}/`)) {
    throw new AppError(400, 'UPLOAD_NOT_YOURS', 'This upload does not belong to your account');
  }
  const operator = await Operator.findById(opts.operatorId).select('status').lean();
  if (!operator) throw new AppError(400, 'INVALID_REFERENCE', 'Unknown operator');
  await assertMetaRefs(opts.meta);

  const asset = await media.getAsset(publicId, 'video');
  if (!asset)
    throw new AppError(400, 'UPLOAD_NOT_FOUND', 'Upload not found — please upload the video again');
  const tooLong = (asset.duration ?? 0) > MEDIA_LIMITS.shortMaxSeconds + 0.5;
  const tooBig = asset.bytes > MEDIA_LIMITS.shortMaxBytes;
  if (tooLong || tooBig) {
    destroyLater(media, opts.logger, publicId, 'video');
    throw tooLong
      ? new AppError(
          400,
          'VIDEO_TOO_LONG',
          `Shorts can be at most ${MEDIA_LIMITS.shortMaxSeconds} seconds`,
        )
      : new AppError(400, 'VIDEO_TOO_LARGE', 'Shorts can be at most 100 MB');
  }

  const cloud = media.cloudName!;
  const short = await Short.create({
    operator: opts.operatorId,
    city: opts.meta.city,
    droneModel: opts.meta.droneModel ?? null,
    eventType: opts.meta.eventType,
    title: opts.meta.title,
    caption: opts.meta.caption ?? null,
    cloudinaryPublicId: publicId,
    videoUrl: shortVideoUrl(cloud, publicId),
    thumbnailUrl: shortThumbnailUrl(cloud, publicId),
    durationSec: Math.round(Math.min(asset.duration ?? 0, MEDIA_LIMITS.shortMaxSeconds)),
    status: opts.status,
    isFeatured: opts.status === 'published' && Boolean(opts.isFeatured),
    operatorActive: operator.status === 'active',
    uploadedBy: opts.uploaderId,
    publishedAt: opts.status === 'published' ? new Date() : null,
  });
  return getManagedShort(short._id);
}

export async function getManagedShort(id: Types.ObjectId | string): Promise<ManagedShort> {
  const s = await populateShort(Short.findById(id)).lean<LeanShort>();
  if (!s) throw AppError.notFound('Short not found');
  return toManagedShort(s);
}

export async function listManagedShorts(q: {
  status?: ShortStatus;
  operator?: Types.ObjectId;
  page: number;
  limit: number;
}) {
  const filter: Record<string, unknown> = {};
  if (q.status) filter.status = q.status;
  if (q.operator) filter.operator = q.operator;
  const [total, rows] = await Promise.all([
    Short.countDocuments(filter),
    populateShort(
      Short.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit),
    ).lean<LeanShort[]>(),
  ]);
  return {
    items: rows.map(toManagedShort),
    meta: {
      page: q.page,
      limit: q.limit,
      total,
      pages: Math.ceil(total / q.limit),
    } satisfies PageMeta,
  };
}

/** Builds a $set from metadata edits (validated refs; optional caption/drone sent empty → cleared). */
export async function buildShortUpdate(input: Partial<ShortMeta> & Record<string, unknown>) {
  await assertMetaRefs(input);
  const set: Record<string, unknown> = {};
  for (const key of ['title', 'city', 'eventType'] as const)
    if (input[key] !== undefined) set[key] = input[key];
  if ('caption' in input) set.caption = input.caption ?? null;
  if ('droneModel' in input) set.droneModel = input.droneModel ?? null;
  return set;
}

export async function deleteShort(
  id: Types.ObjectId | string,
  media: MediaService,
  logger: Logger,
) {
  const s = await Short.findById(id).select('cloudinaryPublicId').lean();
  if (!s) throw AppError.notFound('Short not found');
  await Promise.all([
    ShortLike.deleteMany({ short: s._id }),
    SavedShort.deleteMany({ short: s._id }),
  ]);
  await Short.deleteOne({ _id: s._id });
  destroyLater(media, logger, s.cloudinaryPublicId, 'video');
}

/** Keeps the denormalised flag in sync when an operator is (de)activated. */
export const syncOperatorShorts = (operatorId: Types.ObjectId | string, active: boolean) =>
  Short.updateMany({ operator: operatorId }, { operatorActive: active });

export async function deleteOperatorShorts(
  operatorId: Types.ObjectId | string,
  media: MediaService,
  logger: Logger,
) {
  const shorts = await Short.find({ operator: operatorId }).select('_id').lean();
  for (const s of shorts) await deleteShort(s._id, media, logger);
}
