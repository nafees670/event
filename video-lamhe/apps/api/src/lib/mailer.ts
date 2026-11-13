import nodemailer from 'nodemailer';
import type { Logger } from 'pino';
import type { Env } from '../config/env.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface Mailer {
  send(msg: MailMessage): Promise<void>;
}

/**
 * SMTP when configured; otherwise (local dev only — env validation requires SMTP in
 * production) the email is written to the log so flows like password reset can be tested.
 */
export function createMailer(env: Env, logger: Logger): Mailer {
  if (!env.SMTP_HOST) {
    return {
      async send(msg) {
        logger.info({ mail: { to: msg.to, subject: msg.subject } }, `[dev mailer]\n${msg.text}`);
      },
    };
  }
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  const from = env.ADMIN_EMAIL
    ? `Video Lamhe <${env.ADMIN_EMAIL}>`
    : 'Video Lamhe <no-reply@localhost>';
  return {
    async send(msg) {
      await transport.sendMail({ from, ...msg });
    },
  };
}
