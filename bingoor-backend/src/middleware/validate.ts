import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodIssue, ZodTypeAny } from 'zod';
import { ApiError } from '../utils/ApiError';

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

const LABELS: Record<string, string> = {
  name: 'Name',
  phone: 'Mobile number',
  email: 'Email',
  password: 'Password',
  shopName: 'Warehouse name',
  line1: 'Address',
  city: 'City',
  state: 'State',
  pincode: 'PIN code',
  location: 'Map location',
  gst: 'GST number',
  note: 'Note',
};

const label = (path: (string | number)[]): string => {
  const key = String(path[path.length - 1] ?? '');
  return LABELS[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
};

/** One sentence a person can act on, instead of zod's "String must contain at least 5 character(s)". */
function sentence(issue: ZodIssue): string {
  const who = label(issue.path) || 'This field';
  switch (issue.code) {
    case 'too_small':
      return issue.type === 'string' ? `${who} must be at least ${issue.minimum} characters` : `${who} is too small (minimum ${issue.minimum})`;
    case 'too_big':
      return issue.type === 'string' ? `${who} must be at most ${issue.maximum} characters` : `${who} is too large (maximum ${issue.maximum})`;
    case 'invalid_type':
      return issue.received === 'undefined' ? `${who} is required` : `${who} is not valid`;
    case 'invalid_string':
      return issue.validation === 'email' ? `${who} is not a valid email address` : issue.message;
    default:
      // Custom messages we wrote ourselves ("Enter a valid 10-digit mobile number") read best as they are.
      return issue.message && issue.message !== 'Invalid' ? (issue.path.length ? `${who}: ${issue.message}` : issue.message) : `${who} is not valid`;
  }
}

/** Validates (and coerces) request parts with zod. Parsed values replace the originals. */
export const validate =
  (schemas: Schemas) => (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) (req as any).query = schemas.query.parse(req.query);
      if (schemas.params) (req as any).params = schemas.params.parse(req.params);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const flat = err.flatten();
        // The headline already says what is wrong, so every client (website, app, panels) can show it as is.
        const message = Array.from(new Set(err.issues.slice(0, 3).map(sentence))).join('. ');
        return next(new ApiError(400, message || 'Validation failed', { ...flat.fieldErrors, _form: flat.formErrors }));
      }
      next(err);
    }
  };
