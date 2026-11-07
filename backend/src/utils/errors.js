export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function notFound(req, _res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
}

export function errorHandler(error, _req, res, _next) {
  const status = error.statusCode || (error.name === 'ValidationError' ? 422 : 500);
  if (status >= 500) console.error(error);
  res.status(status).json({
    error: {
      code: error.code || (error.name === 'ValidationError' ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR'),
      message: status === 500 && process.env.NODE_ENV === 'production' ? 'Something went wrong.' : error.message,
      details: error.name === 'ZodError' ? error.issues : undefined,
    },
  });
}
