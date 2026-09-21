import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ERROR_CODES, ApiResponse } from '@gatube/shared';
import { logger } from './logger.js';

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response<ApiResponse<never>>,
  _next: NextFunction
): void {
  const requestId = req.headers['x-request-id'] as string;

  if (err instanceof ZodError) {
    logger.warn('Request validation failed', { requestId, path: req.path, issues: err.issues });
    res.status(400).json({
      success: false,
      error: {
        code: ERROR_CODES.BAD_REQUEST,
        message: 'Validation failed for request parameters',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
      }
    });
    return;
  }

  if (err instanceof AppError) {
    logger.warn(`AppError [${err.code}]: ${err.message}`, { requestId, code: err.code, details: err.details });
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    });
    return;
  }

  logger.error('Unhandled Internal Server Error', err, { requestId, path: req.path });
  res.status(500).json({
    success: false,
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: 'An internal server error occurred. Please try again later.'
    }
  });
}
