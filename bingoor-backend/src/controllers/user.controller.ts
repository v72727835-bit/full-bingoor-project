import { Product } from '../models/Product';
import { User } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { created, ok } from '../utils/response';

const MAX_ADDRESSES = 10;

/* ---------------- profile ---------------- */
export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user!.id);
  if (!user) throw new ApiError(404, 'User not found');
  ok(res, user);
});

export const updateMe = asyncHandler(async (req, res) => {
  const { email } = req.body as { email?: string };
  if (email && (await User.exists({ email, role: req.user!.role, _id: { $ne: req.user!.id } }))) {
    throw new ApiError(409, 'Email already registered');
  }
  const user = await User.findByIdAndUpdate(req.user!.id, { $set: req.body }, { new: true, runValidators: true });
  if (!user) throw new ApiError(404, 'User not found');
  ok(res, user);
});

/* ---------------- addresses ---------------- */
export const listAddresses = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user!.id).select('addresses');
  ok(res, user?.addresses ?? []);
});

export const addAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user!.id);
  if (!user) throw new ApiError(404, 'User not found');
  if (user.addresses.length >= MAX_ADDRESSES) {
    throw new ApiError(400, `You can save up to ${MAX_ADDRESSES} addresses`);
  }

  const makeDefault = req.body.isDefault === true || user.addresses.length === 0;
  if (makeDefault) user.addresses.forEach((a) => (a.isDefault = false));
  user.addresses.push({ ...req.body, isDefault: makeDefault });
  await user.save();

  created(res, user.addresses[user.addresses.length - 1]);
});

export const updateAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user!.id);
  const address = user?.addresses.id(req.params.addressId);
  if (!user || !address) throw new ApiError(404, 'Address not found');

  if (req.body.isDefault === true) user.addresses.forEach((a) => (a.isDefault = false));
  address.set(req.body);
  await user.save();
  ok(res, address);
});

export const setDefaultAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user!.id);
  const address = user?.addresses.id(req.params.addressId);
  if (!user || !address) throw new ApiError(404, 'Address not found');

  user.addresses.forEach((a) => (a.isDefault = false));
  address.isDefault = true;
  await user.save();
  ok(res, user.addresses);
});

export const deleteAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user!.id);
  const address = user?.addresses.id(req.params.addressId);
  if (!user || !address) throw new ApiError(404, 'Address not found');

  const wasDefault = address.isDefault;
  address.deleteOne();
  if (wasDefault && user.addresses.length > 0) user.addresses[0].isDefault = true;
  await user.save();
  ok(res, user.addresses);
});

/* ---------------- wishlist ---------------- */
export const getWishlist = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user!.id)
    .select('wishlist')
    .populate({
      path: 'wishlist',
      match: { isActive: true },
      select: 'name slug images price mrp unit stock rating ratingCount shop',
    })
    .lean();
  ok(res, (user?.wishlist ?? []).filter(Boolean));
});

export const addToWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  if (!(await Product.exists({ _id: productId, isActive: true }))) throw new ApiError(404, 'Product not found');
  await User.updateOne({ _id: req.user!.id }, { $addToSet: { wishlist: productId } });
  ok(res, { productId, wishlisted: true });
});

export const removeFromWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  await User.updateOne({ _id: req.user!.id }, { $pull: { wishlist: productId } });
  ok(res, { productId, wishlisted: false });
});
