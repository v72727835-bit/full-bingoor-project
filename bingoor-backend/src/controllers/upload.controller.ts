import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/response';

export const uploadImages = asyncHandler(async (req, res) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files?.length) throw new ApiError(400, 'Select at least one image to upload');

  const forwardedProtocol = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const baseUrl = `${forwardedProtocol || req.protocol}://${req.get('host')}`;
  const urls = files.map((file) => `${baseUrl}/uploads/products/${file.filename}`);

  ok(res, { urls });
});

export const uploadVideo = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) throw new ApiError(400, 'Choose a video to upload');
  const forwardedProtocol = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const baseUrl = `${forwardedProtocol || req.protocol}://${req.get('host')}`;
  ok(res, { url: `${baseUrl}/uploads/products/${file.filename}` });
});
