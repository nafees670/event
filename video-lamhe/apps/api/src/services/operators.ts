import { randomBytes } from 'node:crypto';
import { Types } from 'mongoose';
import type { OperatorStatus } from '@video-lamhe/shared';
import type { Logger } from 'pino';
import { AppError } from '../lib/errors.js';
import { destroyLater, isOurAssetUrl, publicIdFromUrl, type MediaService } from '../lib/media.js';
import { hashPassword } from '../lib/password.js';
import { uniqueSlug } from '../lib/slug.js';
import { Operator } from '../models/Operator.js';
import { OperatorDrone } from '../models/OperatorDrone.js';
import { User, type UserDoc } from '../models/User.js';
import { assertCitiesExist, assertDroneModelsExist, recomputePriceFrom } from './catalog.js';
import { revokeAllSessions } from './sessions.js';
import { deleteOperatorShorts, syncOperatorShorts } from './shorts.js';

export interface OperatorProfileInput {
  businessName?: string;
  bio?: string;
  photoUrl?: string;
  baseCity?: string;
  serviceCities?: string[];
  phone?: string;
  whatsapp?: string;
  experienceYears?: number;
  socialLinks?: Record<string, string | undefined>;
  isVerified?: boolean;
}

export interface DroneInput {
  model: string;
  pricePerEvent?: number;
  pricePerHour?: number;
  isAvailable: boolean;
}

/**
 * Validates references and turns profile input into an Operator $set.
 * serviceCities never repeats the base city. `current` is needed for partial updates.
 */
export async function buildProfileUpdate(
  input: OperatorProfileInput,
  current?: { baseCity: Types.ObjectId; serviceCities: Types.ObjectId[]; phone?: string },
  /** Our Cloudinary cloud — the photo must be an upload to it. */
  cloudName: string | null = null,
): Promise<Record<string, unknown>> {
  if (input.photoUrl && !isOurAssetUrl(input.photoUrl, cloudName, 'image')) {
    throw new AppError(400, 'INVALID_MEDIA', 'Upload the photo through Video Lamhe');
  }
  const set: Record<string, unknown> = {};
  for (const key of ['businessName', 'experienceYears', 'isVerified', 'phone'] as const) {
    if (input[key] !== undefined) set[key] = input[key];
  }
  // Optional text: a key sent empty ('' → undefined) means "clear it".
  for (const key of ['bio', 'photoUrl'] as const) {
    if (key in input) set[key] = input[key] ?? null;
  }
  // Empty WhatsApp falls back to the (new or current) phone number.
  if ('whatsapp' in input) set.whatsapp = input.whatsapp ?? input.phone ?? current?.phone;
  if (input.socialLinks !== undefined) set.socialLinks = input.socialLinks;

  if (input.baseCity !== undefined || input.serviceCities !== undefined) {
    const base = input.baseCity ?? String(current?.baseCity);
    const service = input.serviceCities ?? (current?.serviceCities ?? []).map(String);
    await assertCitiesExist([base, ...service]);
    set.baseCity = new Types.ObjectId(base);
    set.serviceCities = [...new Set(service.filter((c) => c !== base))].map(
      (c) => new Types.ObjectId(c),
    );
  }
  return set;
}

/** Creates the operator's User + Operator (+ drones). Undoes partial work on failure (no transactions on a standalone Mongo). */
export async function createOperatorAccount(opts: {
  name: string;
  email: string;
  password?: string; // omitted for admin-created operators (they get an invite)
  bcryptRounds: number;
  profile: OperatorProfileInput & { businessName: string; baseCity: string; phone: string };
  status: OperatorStatus;
  isVerified?: boolean;
  drones?: DroneInput[];
  cloudName?: string | null;
}): Promise<{ user: UserDoc; operatorId: Types.ObjectId }> {
  if (await User.exists({ email: opts.email })) {
    throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
  }
  const set = await buildProfileUpdate(opts.profile, undefined, opts.cloudName ?? null);
  if (opts.drones?.length) await assertDroneModelsExist(opts.drones.map((d) => d.model));

  const password = opts.password ?? randomBytes(32).toString('base64url'); // unusable until invite accepted
  const user = await User.create({
    name: opts.name,
    email: opts.email,
    phone: opts.profile.phone,
    passwordHash: await hashPassword(password, opts.bcryptRounds),
    role: 'operator',
  });

  try {
    const operator = await Operator.create({
      ...set,
      user: user._id,
      slug: await uniqueSlug(Operator, opts.profile.businessName),
      whatsapp: opts.profile.whatsapp ?? opts.profile.phone,
      status: opts.status,
      isVerified: opts.isVerified ?? false,
    });
    if (opts.drones?.length) {
      await OperatorDrone.insertMany(opts.drones.map((d) => ({ ...d, operator: operator._id })));
      await recomputePriceFrom(operator._id);
    }
    return { user, operatorId: operator._id };
  } catch (err) {
    await Operator.deleteOne({ user: user._id });
    await User.deleteOne({ _id: user._id });
    throw err;
  }
}

/** Replaces an operator's full drone list (admin form). */
export async function replaceOperatorDrones(operatorId: Types.ObjectId, drones: DroneInput[]) {
  await assertDroneModelsExist(drones.map((d) => d.model));
  const keep = drones.map((d) => new Types.ObjectId(d.model));
  await OperatorDrone.deleteMany({ operator: operatorId, model: { $nin: keep } });
  for (const d of drones) {
    await OperatorDrone.updateOne(
      { operator: operatorId, model: d.model },
      {
        $set: {
          pricePerEvent: d.pricePerEvent ?? null,
          pricePerHour: d.pricePerHour ?? null,
          isAvailable: d.isAvailable,
        },
      },
      { upsert: true },
    );
  }
  await recomputePriceFrom(operatorId);
}

export async function setOperatorStatus(operatorId: string, status: OperatorStatus) {
  const op = await Operator.findByIdAndUpdate(operatorId, { status }, { new: false });
  if (!op) throw AppError.notFound('Operator not found');
  // A deactivated operator must not stay logged in.
  if (status === 'inactive' && op.status !== 'inactive') await revokeAllSessions(op.user);
  // Their shorts follow: hidden from the feed unless the operator is active.
  await syncOperatorShorts(op._id, status === 'active');
  return op;
}

/** Removes the operator profile, drones, shorts and media; the person keeps a plain customer account. */
export async function deleteOperator(operatorId: string, media: MediaService, logger: Logger) {
  const op = await Operator.findById(operatorId);
  if (!op) throw AppError.notFound('Operator not found');
  await deleteOperatorShorts(op._id, media, logger);
  destroyLater(media, logger, op.photoUrl ? publicIdFromUrl(op.photoUrl) : null, 'image');
  await OperatorDrone.deleteMany({ operator: op._id });
  await Operator.deleteOne({ _id: op._id });
  await User.updateOne({ _id: op.user }, { role: 'customer' });
  await revokeAllSessions(op.user);
}

/** After a photo change, delete the replaced Cloudinary image. */
export function cleanupReplacedPhoto(
  media: MediaService,
  logger: Logger,
  previous: string | null | undefined,
  next: unknown,
) {
  if (previous && previous !== next)
    destroyLater(media, logger, publicIdFromUrl(previous), 'image');
}
