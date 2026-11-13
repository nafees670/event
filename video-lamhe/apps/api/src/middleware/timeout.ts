import type { RequestHandler } from 'express';
import { AppError } from '../lib/errors.js';

/** Fail requests that take longer than `ms` with a 503 instead of hanging. */
export function requestTimeout(ms: number): RequestHandler {
  return (_req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) next(new AppError(503, 'TIMEOUT', 'Request timed out'));
    }, ms);
    const clear = () => clearTimeout(timer);
    res.on('finish', clear);
    res.on('close', clear);
    next();
  };
}
