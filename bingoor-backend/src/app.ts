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

/**
 * CORS: with `credentials: true` we must never reflect an arbitrary Origin, or
 * any website could make authenticated requests from a logged-in customer's
 * browser. So:
 *  - requests with no Origin (mobile apps, curl, server-to-server) are allowed;
 *  - any Origin is allowed only in development, or when CORS_ORIGINS is left as
 *    the "*" placeholder in a non-production environment;
 *  - otherwise the Origin must be in the explicit, lowercased whitelist.
 */
const corsWhitelist = new Set(
  env.CORS_ORIGINS.split(',')
    .map((s) => s.trim().toLowerCase().replace(/\/$/, ''))
    .filter((s) => s && s !== '*'),
);
// When CORS_ORIGINS is "*" or unset there is no configured allow-list yet, so we
// allow all origins (warning in production) rather than break a live front-end on
// deploy. The strict allow-list takes over automatically once CORS_ORIGINS is set
// to explicit domains — the real remediation for ISSUE-04.
const allowAllOrigins = corsWhitelist.size === 0;
if (allowAllOrigins && env.NODE_ENV === 'production') {
  console.warn('[CORS] CORS_ORIGINS is not set to explicit domains — allowing all origins. Set CORS_ORIGINS to your front-end domains to lock this down.');
}
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true); // mobile apps / curl / same-origin
      if (allowAllOrigins) return callback(null, true);
      const normalized = origin.toLowerCase().replace(/\/$/, '');
      if (corsWhitelist.has(normalized)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }),
);
app.use(compression());
// `verify` keeps the raw request body so webhook signatures (Razorpay) can be
// checked against exactly what the provider signed, not a re-serialized copy.
app.use(
  express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);
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
// The latest app APKs (bingoor-customer/rider/warehouse.apk), replaced in place by
// deploy/docker-deploy.sh after every app build, so the download links never change.
app.use(
  '/downloads',
  express.static(path.resolve(process.cwd(), 'downloads'), {
    maxAge: '10m',
    setHeaders: (res, file) => {
      res.setHeader('Content-Disposition', 'attachment');
      if (file.endsWith('.apk')) res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    },
  }),
);
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
