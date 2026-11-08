import { AppError } from '../utils/errors.js';

export function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success)
      return next(
        new AppError(
          result.error.issues[0]?.message || 'Invalid request.',
          422,
          'VALIDATION_ERROR',
        ),
      );
    req.validatedBody = result.data;
    next();
  };
}

export function validateId(_req, _res, next, value) {
  if (!/^[a-f\d]{24}$/i.test(value))
    return next(new AppError('Invalid resource ID.', 422, 'INVALID_ID'));
  next();
}
