import cors from 'cors';
import express from 'express';

import type { Database } from './db/index.js';
import { createRoutes } from './routes/index.js';

export function createApp(db: Database) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '8mb' }));
  app.use('/api', createRoutes(db));
  return app;
}
