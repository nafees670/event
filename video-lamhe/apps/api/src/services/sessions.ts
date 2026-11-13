import type { Types } from 'mongoose';
import { RefreshSession } from '../models/RefreshSession.js';
import { User } from '../models/User.js';

/** Logs a user out everywhere: refresh tokens die now, access tokens within 15 min. */
export async function revokeAllSessions(userId: Types.ObjectId | string): Promise<void> {
  await User.updateOne({ _id: userId }, { $inc: { refreshTokenVersion: 1 } });
  await RefreshSession.deleteMany({ user: userId });
}
