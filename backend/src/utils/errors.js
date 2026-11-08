export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}
export function notFound(req, _res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.path}`, 404, 'NOT_FOUND'));
}
export function errorHandler(error, req, res, _next) {
  if (res.headersSent) return _next(error);
  let status = error.statusCode || error.status || 500;
  let code = typeof error.code === 'string' ? error.code : 'INTERNAL_ERROR';
  let message = error.message;
  if (['ZodError', 'ValidationError', 'CastError'].includes(error.name)) {
    status = 422;
    code = 'VALIDATION_ERROR';
    message = error.issues?.[0]?.message || 'Invalid request.';
  }
  if (error.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Request body must be valid JSON.';
  }
  if (error.code === 11000) {
    status = 409;
    code = 'RESOURCE_CONFLICT';
    message = 'An account or schedule with these details already exists.';
  }
  if (status >= 500)
    console.error(
      JSON.stringify({ level: 'error', requestId: req.id, code, message: error.message }),
    );
  res.status(status).json({
    error: {
      code,
      message:
        status >= 500 && process.env.NODE_ENV === 'production'
          ? 'The service could not complete this request.'
          : message,
      requestId: req.id,
      details:
        error.name === 'ZodError'
          ? error.issues.map(({ path, message }) => ({ path, message }))
          : undefined,
    },
  });
}
