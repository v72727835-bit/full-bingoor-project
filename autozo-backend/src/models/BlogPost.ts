import { Schema, model } from 'mongoose';
import { uniqueSlug } from '../utils/helpers';

/** #38: a blog post written in the admin panel and shown at bingoor.com/blog. */
export interface IBlogPost {
  title: string;
  slug: string;
  /** One or two lines shown on the blog list. */
  excerpt?: string;
  /** Formatted text (same safe HTML as product descriptions). */
  body: string;
  cover?: string;
  author?: string;
  published: boolean;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const blogPostSchema = new Schema<IBlogPost>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    excerpt: { type: String, trim: true },
    body: { type: String, default: '' },
    cover: { type: String, trim: true },
    author: { type: String, trim: true },
    published: { type: Boolean, default: false },
    publishedAt: Date,
  },
  { timestamps: true },
);
blogPostSchema.index({ published: 1, publishedAt: -1 });

blogPostSchema.pre('validate', function (next) {
  if (!this.slug) this.slug = uniqueSlug(this.title);
  if (this.published && !this.publishedAt) this.publishedAt = new Date();
  next();
});

export const BlogPost = model<IBlogPost>('BlogPost', blogPostSchema);
