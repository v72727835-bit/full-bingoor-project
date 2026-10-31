import { Schema, model } from 'mongoose';

/**
 * One entry of the public Gallery (photos) or Videos page, managed by the
 * super admin. A photo is an uploaded image; a video is a YouTube / Vimeo link
 * or a direct .mp4 / .webm file link.
 */
export interface IMediaItem {
  kind: 'photo' | 'video';
  title: string;
  caption?: string;
  /** Photo: the image. Video: the YouTube / Vimeo / mp4 link as pasted. */
  url: string;
  /** Optional cover for a video (YouTube covers are worked out automatically). */
  thumbnail?: string;
  sortOrder: number;
  isActive: boolean;
}

const mediaSchema = new Schema<IMediaItem>(
  {
    kind: { type: String, enum: ['photo', 'video'], required: true },
    title: { type: String, required: true, trim: true },
    caption: { type: String, trim: true },
    url: { type: String, required: true, trim: true },
    thumbnail: { type: String, trim: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

mediaSchema.index({ kind: 1, isActive: 1, sortOrder: 1, createdAt: -1 });

export const MediaItem = model<IMediaItem>('MediaItem', mediaSchema);
