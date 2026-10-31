import { Types } from 'mongoose';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { Review } from '../models/Review';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { round2 } from '../utils/helpers';
import { created, ok, pageMeta } from '../utils/response';

async function recomputeProductRating(productId: Types.ObjectId | string) {
  const [agg] = await Review.aggregate<{ avg: number; count: number }>([
    { $match: { product: new Types.ObjectId(String(productId)) } },
    { $group: { _id: '$product', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await Product.updateOne(
    { _id: productId },
    { $set: { rating: agg ? round2(agg.avg) : 0, ratingCount: agg?.count ?? 0 } },
  );
}

export const listReviews = asyncHandler(async (req, res) => {
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const filter = { product: req.params.id };

  const [reviews, total, breakdown] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'name avatar')
      .lean(),
    Review.countDocuments(filter),
    Review.aggregate<{ _id: number; count: number }>([
      { $match: { product: new Types.ObjectId(req.params.id) } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]),
  ]);

  // { "5": 12, "4": 3, "3": 0, ... }
  const stars: Record<string, number> = { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 };
  breakdown.forEach((b) => (stars[String(b._id)] = b.count));

  ok(res, { reviews, breakdown: stars }, pageMeta(page, limit, total));
});

/** Create or update the logged-in customer's review. Only allowed after receiving the product. */
export const upsertReview = asyncHandler(async (req, res) => {
  const { id: productId } = req.params;
  const userId = req.user!.id;

  const bought = await Order.exists({ user: userId, status: 'delivered', 'items.product': productId });
  if (!bought) throw new ApiError(403, 'You can review a product only after it has been delivered to you');

  const review = await Review.findOneAndUpdate(
    { user: userId, product: productId },
    { $set: { rating: req.body.rating, comment: req.body.comment } },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
  );
  await recomputeProductRating(productId);
  created(res, review);
});

export const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findOneAndDelete({ _id: req.params.id, user: req.user!.id });
  if (!review) throw new ApiError(404, 'Review not found');
  await recomputeProductRating(review.product);
  ok(res, { message: 'Review deleted' });
});
