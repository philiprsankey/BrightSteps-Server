import { eq } from 'drizzle-orm';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';

import type { Database } from '../db/index.js';
import { parentConsentsTable } from '../db/schema.js';
import { parentId, requireParent } from '../middleware/auth.js';

const ConsentInput = z.object({
  accepted: z.literal(true),
});

export function createConsentRoutes(db: Database) {
  const router = Router();
  router.use(requireParent);

  router.get('/consent', async (req, res, next) => {
    try {
      const [consent] = await db
        .select({ parentId: parentConsentsTable.parentId })
        .from(parentConsentsTable)
        .where(eq(parentConsentsTable.parentId, parentId(req)));
      res.json({ accepted: !!consent });
    } catch (error) {
      next(error);
    }
  });

  router.post('/consent', async (req, res, next) => {
    try {
      const parsed = ConsentInput.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Please agree before continuing.' });
        return;
      }

      await db
        .insert(parentConsentsTable)
        .values({ parentId: parentId(req) })
        .onConflictDoNothing();

      res.json({ accepted: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export function requireConsent(db: Database) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [consent] = await db
        .select({ parentId: parentConsentsTable.parentId })
        .from(parentConsentsTable)
        .where(eq(parentConsentsTable.parentId, parentId(req)));

      if (!consent) {
        res.status(403).json({ error: 'Parental consent is required before using child profiles.' });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
