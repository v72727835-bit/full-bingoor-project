import { Response } from 'express';

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
}

export function pageMeta(page: number, limit: number, total: number): PageMeta {
  return { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total };
}

export function ok(res: Response, data: unknown, meta?: unknown, status = 200) {
  const body: Record<string, unknown> = { success: true, data };
  if (meta !== undefined) body.meta = meta;
  return res.status(status).json(body);
}

export function created(res: Response, data: unknown, meta?: unknown) {
  return ok(res, data, meta, 201);
}
