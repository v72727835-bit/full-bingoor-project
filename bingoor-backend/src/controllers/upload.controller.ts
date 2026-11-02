import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { publicOrigin } from '../utils/publicUrl';
import { ok } from '../utils/response';

export const uploadImages = asyncHandler(async (req, res) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files?.length) throw new ApiError(400, 'Select at least one image to upload');

  const baseUrl = publicOrigin(req);
  const urls = files.map((file) => `${baseUrl}/uploads/products/${file.filename}`);

  ok(res, { urls });
});

export const uploadVideo = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) throw new ApiError(400, 'Choose a video to upload');
  const baseUrl = publicOrigin(req);
  ok(res, { url: `${baseUrl}/uploads/products/${file.filename}` });
});
