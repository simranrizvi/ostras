import { AppError } from '../utils/errors.js';

export function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(new AppError(result.error.issues[0]?.message || 'Invalid request.', 422, 'VALIDATION_ERROR'));
    req.validatedBody = result.data;
    next();
  };
}
