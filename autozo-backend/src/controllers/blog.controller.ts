import { BlogPost } from '../models/BlogPost';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { created, ok, pageMeta } from '../utils/response';

/* ============ Public: bingoor.com/blog ============ */

export const listPosts = asyncHandler(async (req, res) => {
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const filter = { published: true };
  const [rows, total] = await Promise.all([
    BlogPost.find(filter).sort({ publishedAt: -1 }).skip((page - 1) * limit).limit(limit).select('title slug excerpt cover author publishedAt').lean(),
    BlogPost.countDocuments(filter),
  ]);
  ok(res, rows, pageMeta(page, limit, total));
});

export const getPost = asyncHandler(async (req, res) => {
  const post = await BlogPost.findOne({ slug: String(req.params.slug).toLowerCase(), published: true }).lean();
  if (!post) throw new ApiError(404, 'Post not found');
  ok(res, post);
});

/* ============ Admin: write and publish posts ============ */

export const adminListPosts = asyncHandler(async (req, res) => {
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const [rows, total] = await Promise.all([
    BlogPost.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    BlogPost.countDocuments(),
  ]);
  ok(res, rows, pageMeta(page, limit, total));
});

export const adminCreatePost = asyncHandler(async (req, res) => {
  created(res, await BlogPost.create(req.body));
});

export const adminUpdatePost = asyncHandler(async (req, res) => {
  const post = await BlogPost.findById(req.params.id);
  if (!post) throw new ApiError(404, 'Post not found');
  post.set(req.body);
  await post.save();
  ok(res, post);
});

export const adminDeletePost = asyncHandler(async (req, res) => {
  const r = await BlogPost.deleteOne({ _id: req.params.id });
  if (!r.deletedCount) throw new ApiError(404, 'Post not found');
  ok(res, { deleted: true });
});
