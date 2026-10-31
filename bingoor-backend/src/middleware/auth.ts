import { RequestHandler } from 'express';
import { User } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { verifyAccessToken } from '../utils/jwt';

/** Requires a valid access token (Authorization: Bearer <token>). */
export const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new ApiError(401, 'Authentication required');

  const payload = verifyAccessToken(header.slice(7));
  const user = await User.findById(payload.sub).select('role isActive').lean();
  if (!user || !user.isActive) throw new ApiError(401, 'Account not found or disabled');

  req.user = { id: String(user._id), role: user.role };
  next();
});

/** Restricts a route to specific roles. Use after `protect`. */
export const authorize =
  (...roles: Array<'customer' | 'rider' | 'shop' | 'admin' | 'seller'>): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ApiError(403, 'You do not have access to this resource'));
    }
    next();
  };

/** Everything in the public portal that needs a logged-in customer. */
export const customerOnly: RequestHandler[] = [protect, authorize('customer')];

/** Everything in the admin panel. */
export const adminOnly: RequestHandler[] = [protect, authorize('admin')];
