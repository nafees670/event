import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorBody } from '@video-lamhe/shared';
import { AppError } from '../lib/errors.js';

export const notFound: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`Route ${req.method} ${req.path} not found`));
};

interface HttpLikeError {
  status?: number;
  statusCode?: number;
  type?: string;
  expose?: boolean;
  message?: string;
}

function isDuplicateKey(err: unknown): err is { code: 11000; keyValue?: Record<string, unknown> } {
  return Boolean(err && typeof err === 'object' && (err as { code?: unknown }).code === 11000);
}

export function createErrorHandler(isProduction: boolean): ErrorRequestHandler {
  return (err: unknown, req, res, _next) => {
    let status = 500;
    let body: ApiErrorBody = {
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    };

    if (err instanceof AppError) {
      status = err.status;
      body = { error: { code: err.code, message: err.message, details: err.details } };
    } else if (err instanceof ZodError) {
      status = 400;
      body = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request',
          details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
      };
    } else if (isDuplicateKey(err)) {
      // Unique index race (e.g. two signups with the same email at once).
      status = 409;
      body = {
        error: {
          code: 'DUPLICATE',
          message: 'This already exists',
          details: { fields: Object.keys(err.keyValue ?? {}) },
        },
      };
    } else if (err && typeof err === 'object') {
      // body-parser / http-errors style (e.g. invalid JSON, payload too large)
      const e = err as HttpLikeError;
      const s = e.status ?? e.statusCode;
      if (s && s >= 400 && s < 500 && e.expose !== false) {
        status = s;
        body = {
          error: {
            code: e.type === 'entity.too.large' ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
            message: e.message ?? 'Bad request',
          },
        };
      }
    }

    if (status >= 500) {
      req.log?.error({ err }, 'Unhandled error');
      if (!isProduction && err instanceof Error) {
        body.error.details = { message: err.message, stack: err.stack };
      }
    }

    if (res.headersSent) return;
    res.status(status).json(body);
  };
}
