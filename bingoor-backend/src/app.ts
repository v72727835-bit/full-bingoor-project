import compression from 'compression';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { env } from './config/env';
import { errorHandler, notFound } from './middleware/error';
import { parseRange } from './utils/range';
import { findImage } from './utils/imageStore';
import routes from './routes';
import { ensureSettings } from './services/settings.service';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1); // running behind nginx / a load balancer

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: env.CORS_ORIGINS === '*' ? true : env.CORS_ORIGINS.split(',').map((s) => s.trim()),
    credentials: true,
  }),
);
app.use(compression());
app.use(express.json({ limit: '1mb' }));
/* Uploaded images are served from the database; files written to disk by
   older builds are still served below for as long as they exist. */
app.get('/uploads/products/:name', async (req, res, next) => {
  try {
    const image = await findImage(req.params.name);
    if (!image) return next();
    const headers: Record<string, string> = {
      'Content-Type': image.contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=2592000, immutable',
    };
    // Videos are played and skipped through with Range requests (Safari insists on them).
    const range = parseRange(req.headers.range, image.length);
    if (range === 'unsatisfiable') {
      res.status(416).set({ 'Content-Range': `bytes */${image.length}` }).end();
      return;
    }
    if (range) {
      const { start, end } = range;
      res.status(206).set({ ...headers, 'Content-Range': `bytes ${start}-${end}/${image.length}`, 'Content-Length': String(end - start + 1) });
      image.open({ start, end }).on('error', next).pipe(res);
      return;
    }
    res.set({ ...headers, 'Content-Length': String(image.length) });
    image.open().on('error', next).pipe(res);
  } catch (error) {
    next(error);
  }
});
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads'), { maxAge: '30d', immutable: true }));
if (env.NODE_ENV !== 'test') app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(
  '/api',
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 1000, standardHeaders: true, legacyHeaders: false }),
);

app.get('/health', (_req, res) => {
  res.json({ success: true, service: 'bingoor-backend', uptime: process.uptime() });
});

app.use('/api/v1', ensureSettings, routes);

app.use(notFound);
app.use(errorHandler);

export default app;
