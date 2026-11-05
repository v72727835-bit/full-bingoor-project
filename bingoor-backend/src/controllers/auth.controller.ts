import crypto from 'crypto';
import { getIntegrations } from '../services/integrations.service';
import { User, UserDoc } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { sha256, signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { created, ok } from '../utils/response';

const MAX_SESSIONS = 5; // refresh tokens kept per user (one per logged-in device)

async function issueTokens(user: UserDoc) {
  const accessToken = signAccessToken(user.id, user.role);
  const refreshToken = signRefreshToken(user.id);
  await User.updateOne(
    { _id: user._id },
    {
      $push: { refreshTokens: { $each: [{ hash: sha256(refreshToken), createdAt: new Date() }], $slice: -MAX_SESSIONS } },
      $set: { lastLoginAt: new Date() },
    },
  );
  return { accessToken, refreshToken };
}

export const register = asyncHandler(async (req, res) => {
  const { name, phone, email, password } = req.body;

  const clash = await User.findOne({ role: 'customer', $or: [{ phone }, ...(email ? [{ email }] : [])] }).select('phone email');
  if (clash) {
    throw new ApiError(409, clash.phone === phone ? 'Phone number already registered' : 'Email already registered');
  }

  const user = await User.create({ name, phone, email, password, role: 'customer' });
  const tokens = await issueTokens(user);
  created(res, { user, ...tokens });
});

export const login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body as { identifier: string; password: string };

  const query = identifier.includes('@')
    ? { email: identifier.toLowerCase(), role: 'customer' }
    : { phone: identifier.replace(/[\s-]/g, '').replace(/^(\+91|91)(?=\d{10}$)/, ''), role: 'customer' };

  const user = await User.findOne(query).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid phone/email or password');
  }
  if (!user.isActive) throw new ApiError(403, 'Your account has been disabled. Please contact support.');
  if (user.role !== 'customer') throw new ApiError(403, 'This login is for customers only. Use your own portal.');

  const tokens = await issueTokens(user);
  ok(res, { user, ...tokens });
});

export const riderLogin = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body as { identifier: string; password: string };
  const query = identifier.includes('@')
    ? { email: identifier.toLowerCase(), role: 'rider' }
    : { phone: identifier.replace(/[\s-]/g, '').replace(/^(\+91|91)(?=\d{10}$)/, ''), role: 'rider' };
  const user = await User.findOne(query).select('+password');
  if (!user || !(await user.comparePassword(password))) throw new ApiError(401, 'Invalid phone/email or password');
  if (!user.isActive) throw new ApiError(403, 'Your account has been disabled. Please contact support.');
  if (user.role !== 'rider') throw new ApiError(403, 'This login is only for riders.');
  await user.populate('warehouse', 'name');
  const tokens = await issueTokens(user);
  ok(res, { user, ...tokens });
});
export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body as { refreshToken: string };

  let userId: string;
  try {
    userId = String(verifyRefreshToken(refreshToken).sub);
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }

  const hash = sha256(refreshToken);
  const user = await User.findOne({ _id: userId, 'refreshTokens.hash': hash });
  if (!user || !user.isActive) throw new ApiError(401, 'Invalid or expired refresh token');

  // Rotate: drop the used token, hand out a fresh pair
  await User.updateOne({ _id: user._id }, { $pull: { refreshTokens: { hash } } });
  const tokens = await issueTokens(user);
  ok(res, tokens);
});

export const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  // Riders drop off the "online" list as soon as they log out.
  if (req.user!.role === 'rider') await User.updateOne({ _id: req.user!.id }, { $set: { lastSeenAt: null } });
  if (refreshToken) {
    await User.updateOne({ _id: req.user!.id }, { $pull: { refreshTokens: { hash: sha256(refreshToken) } } });
  } else {
    await User.updateOne({ _id: req.user!.id }, { $set: { refreshTokens: [] } }); // log out everywhere
  }
  ok(res, { message: 'Logged out' });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };

  const user = await User.findById(req.user!.id).select('+password');
  if (!user || !(await user.comparePassword(currentPassword))) {
    throw new ApiError(400, 'Current password is incorrect');
  }
  user.password = newPassword;
  user.refreshTokens = []; // sign out all other devices
  await user.save();
  ok(res, { message: 'Password changed. Please log in again on your other devices.' });
});

/* ---------------- Continue with Google / Facebook ---------------- */

interface SocialProfile {
  provider: 'google' | 'facebook' | 'instagram';
  id: string;
  email?: string;
  name: string;
}

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  const json = (await r.json().catch(() => ({}))) as T;
  if (!r.ok) throw new ApiError(401, 'We could not verify your login with that account. Please try again.');
  return json;
}

/** Signs in (or signs up) the customer behind a verified social profile. */
async function signInWithSocial(p: SocialProfile) {
  const key = p.provider === 'google' ? 'googleId' : p.provider === 'facebook' ? 'facebookId' : 'instagramId';
  let user = (await User.findOne({ [key]: p.id, role: 'customer' })) ?? (p.email ? await User.findOne({ email: p.email.toLowerCase(), role: 'customer' }) : null);
  if (user && user.role !== 'customer') throw new ApiError(403, 'This login is for customers only.');
  if (user && !user.isActive) throw new ApiError(403, 'Your account has been disabled. Please contact support.');
  if (!user) {
    // No phone yet: a placeholder keeps the unique phone field valid, and the customer adds a real one in their profile.
    user = await User.create({
      name: p.name || 'Customer',
      phone: `s${crypto.randomBytes(6).toString('hex')}`,
      email: p.email?.toLowerCase(),
      password: crypto.randomBytes(24).toString('hex'),
      role: 'customer',
      [key]: p.id,
    });
  } else if (!(user as unknown as Record<string, unknown>)[key]) {
    await User.updateOne({ _id: user._id }, { $set: { [key]: p.id } });
  }
  const tokens = await issueTokens(user);
  return { user, ...tokens, needsPhone: user.phone.startsWith('s') && !/^\d{10}$/.test(user.phone) };
}

export const googleLogin = asyncHandler(async (req, res) => {
  const { googleClientId } = await getIntegrations();
  if (!googleClientId) throw new ApiError(503, 'Login with Google is not switched on yet.');
  const { accessToken, idToken } = req.body as { accessToken?: string; idToken?: string };
  // The token must have been issued to OUR Google client, or anyone could sign in with another app's token.
  const info = await getJson<{ aud?: string; azp?: string; email?: string; email_verified?: string | boolean; sub?: string; name?: string }>(
    `https://oauth2.googleapis.com/tokeninfo?${idToken ? 'id_token' : 'access_token'}=${encodeURIComponent(idToken ?? accessToken!)}`,
  );
  if ((info.aud ?? info.azp) !== googleClientId || !info.sub) throw new ApiError(401, 'This Google login was not issued for Bingoor.');
  const profile = idToken ? info : await getJson<{ name?: string; email?: string }>(
    `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${encodeURIComponent(accessToken!)}`,
  );
  const verified = info.email_verified === true || info.email_verified === 'true';
  ok(res, await signInWithSocial({ provider: 'google', id: info.sub, email: verified ? info.email ?? profile.email : undefined, name: profile.name ?? info.name ?? '' }));
});

export const facebookLogin = asyncHandler(async (req, res) => {
  const { facebookAppId, facebookAppSecret } = await getIntegrations();
  if (!facebookAppId || !facebookAppSecret) throw new ApiError(503, 'Login with Facebook is not switched on yet.');
  let accessToken = req.body.accessToken as string | undefined;
  if (!accessToken) {
    const params = new URLSearchParams({ client_id: facebookAppId, client_secret: facebookAppSecret,
      redirect_uri: 'https://bingoor.com/auth/mobile/facebook', code: req.body.code });
    const exchanged = await getJson<{ access_token?: string }>(`https://graph.facebook.com/v23.0/oauth/access_token?${params}`);
    accessToken = exchanged.access_token;
    if (!accessToken) throw new ApiError(401, 'Facebook sign-in could not be completed.');
  }
  const appToken = `${facebookAppId}|${facebookAppSecret}`;
  const debug = await getJson<{ data?: { app_id?: string; is_valid?: boolean; user_id?: string } }>(
    `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appToken)}`,
  );
  if (!debug.data?.is_valid || debug.data.app_id !== facebookAppId || !debug.data.user_id) {
    throw new ApiError(401, 'This Facebook login was not issued for Bingoor.');
  }
  const me = await getJson<{ id: string; name?: string; email?: string }>(
    `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(accessToken)}`,
  );
  ok(res, await signInWithSocial({ provider: 'facebook', id: me.id, email: me.email, name: me.name ?? '' }));
});

/**
 * Continue with Instagram (Instagram API with Instagram Login). The website
 * sends the one-time code Instagram gave it; only the server knows the app
 * secret, so only the server can turn that code into the customer's Instagram
 * id - a code made for another app is refused by Instagram itself. Instagram
 * shares no email, so the account is matched on the Instagram id alone.
 */
export const instagramLogin = asyncHandler(async (req, res) => {
  const { instagramAppId, instagramAppSecret } = await getIntegrations();
  if (!instagramAppId || !instagramAppSecret) throw new ApiError(503, 'Login with Instagram is not switched on yet.');
  const { code, redirectUri } = req.body as { code: string; redirectUri: string };
  const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: instagramAppId,
      client_secret: instagramAppSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code: code.replace(/#_$/, ''),
    }),
  });
  const token = (await tokenRes.json().catch(() => ({}))) as { access_token?: string; user_id?: string | number; error_message?: string };
  if (!tokenRes.ok || !token.access_token) {
    throw new ApiError(401, 'Instagram did not confirm this login. Please try again, or continue with your phone number.');
  }
  const me = await getJson<{ user_id?: string | number; id?: string; username?: string; name?: string }>(
    `https://graph.instagram.com/me?fields=user_id,username,name&access_token=${encodeURIComponent(token.access_token)}`,
  );
  const id = String(me.user_id ?? token.user_id ?? me.id ?? '');
  if (!id) throw new ApiError(401, 'Instagram did not confirm this login. Please try again.');
  ok(res, await signInWithSocial({ provider: 'instagram', id, name: me.name || me.username || '' }));
});
