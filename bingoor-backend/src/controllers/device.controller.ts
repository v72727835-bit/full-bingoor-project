import { DeviceToken } from '../models/DeviceToken';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/response';

/** The app or browser registers its push token after login; one token belongs to one user at a time. */
export const registerDevice = asyncHandler(async (req, res) => {
  const { token, platform, app } = req.body as { token: string; platform: 'web' | 'android' | 'ios'; app: 'customer' | 'rider' | 'warehouse' | 'web' };
  await DeviceToken.updateOne({ token }, { $set: { user: req.user!.id, platform, app } }, { upsert: true });
  ok(res, { registered: true });
});

export const removeDevice = asyncHandler(async (req, res) => {
  await DeviceToken.deleteOne({ token: (req.body as { token: string }).token, user: req.user!.id });
  ok(res, { removed: true });
});
