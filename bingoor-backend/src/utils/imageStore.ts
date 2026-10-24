import mongoose from 'mongoose';

/**
 * Uploaded images live in MongoDB (GridFS), not on the server's disk.
 *
 * The host's disk is wiped on every deploy and restart, so files written
 * there vanished and left broken images across the app. The database
 * survives deploys, so images stored in it do too.
 */
const bucket = () => {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database is not connected');
  return new mongoose.mongo.GridFSBucket(db, { bucketName: 'uploads' });
};

export function saveImage(filename: string, contentType: string, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    bucket()
      .openUploadStream(filename, { metadata: { contentType } })
      .on('error', reject)
      .on('finish', () => resolve())
      .end(data);
  });
}

export async function findImage(filename: string) {
  const [file] = await bucket().find({ filename }).limit(1).toArray();
  if (!file) return null;
  return {
    contentType: (file.metadata?.contentType as string | undefined) ?? 'application/octet-stream',
    length: file.length,
    open: (range?: { start: number; end: number }) =>
      bucket().openDownloadStream(file._id, range ? { start: range.start, end: range.end + 1 } : undefined),
  };
}
