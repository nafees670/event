import type { Env } from '../config/env.js';
import type { Mailer } from '../lib/mailer.js';
import { createOpaqueToken } from '../lib/tokens.js';
import { User, type UserDoc } from '../models/User.js';

export const INVITE_TTL_MS = 72 * 60 * 60_000;

/**
 * Admin-created operators get a "set your password" link (reuses the password-reset token,
 * valid 72 h). The admin never knows the operator's password.
 */
export async function sendOperatorInvite(
  env: Env,
  mailer: Mailer,
  user: UserDoc,
  businessName: string,
): Promise<void> {
  const { token, hash } = createOpaqueToken();
  await User.updateOne(
    { _id: user._id },
    { passwordResetTokenHash: hash, passwordResetExpiresAt: new Date(Date.now() + INVITE_TTL_MS) },
  );
  const link = `${env.WEB_URL[0]}/reset-password?token=${encodeURIComponent(token)}`;
  await mailer.send({
    to: user.email,
    subject: 'You have been added to Video Lamhe',
    text:
      `Assalam o Alaikum ${user.name},\n\n` +
      `${businessName} has been added as a drone operator on Video Lamhe.\n` +
      `Set your password to access your operator dashboard (link valid for 72 hours):\n${link}\n\n` +
      `— Video Lamhe`,
  });
}
