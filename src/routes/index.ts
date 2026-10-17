import { and, desc, eq, sql } from 'drizzle-orm';
import { Router } from 'express';

import type { Database } from '../db/index.js';
import { childrenTable, sessionsTable } from '../db/schema.js';
import { matchSpokenAnswer } from '../lib/match-answer.js';
import { transcribeAudio } from '../lib/transcribe.js';
import {
  ChildInput,
  ChildUpdateInput,
  serializeChild,
  serializeSession,
  SessionInput,
  TranscribeInput,
} from '../lib/validation.js';
import { parentId, requireParent } from '../middleware/auth.js';
import { createConsentRoutes, requireConsent } from './consent.js';

export function createRoutes(db: Database) {
  const router = Router();
  const needConsent = requireConsent(db);

  router.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.use(createConsentRoutes(db));

  router.get('/children', requireParent, needConsent, async (req, res, next) => {
    try {
      const children = await db
        .select()
        .from(childrenTable)
        .where(eq(childrenTable.parentId, parentId(req)))
        .orderBy(desc(childrenTable.createdAt));
      res.json(children.map(serializeChild));
    } catch (error) {
      next(error);
    }
  });

  router.post('/children', requireParent, needConsent, async (req, res, next) => {
    try {
      const parsed = ChildInput.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Enter a name and an age from 3 to 7.' });
        return;
      }

      const [child] = await db
        .insert(childrenTable)
        .values({
          name: parsed.data.name,
          age: parsed.data.age,
          buddyId: parsed.data.buddyId,
          parentId: parentId(req),
        })
        .returning();

      res.status(201).json(serializeChild(child));
    } catch (error) {
      next(error);
    }
  });

  router.patch('/children/:childId', requireParent, needConsent, async (req, res, next) => {
    try {
      const childId = Number(req.params.childId);
      if (!Number.isInteger(childId) || childId < 1) {
        res.status(400).json({ error: 'Invalid child profile.' });
        return;
      }

      const parsed = ChildUpdateInput.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Pick a buddy for this learner.' });
        return;
      }

      const [child] = await db
        .update(childrenTable)
        .set({ buddyId: parsed.data.buddyId })
        .where(and(eq(childrenTable.id, childId), eq(childrenTable.parentId, parentId(req))))
        .returning();

      if (!child) {
        res.status(404).json({ error: 'Child profile not found.' });
        return;
      }

      res.json(serializeChild(child));
    } catch (error) {
      next(error);
    }
  });

  router.delete('/children/:childId', requireParent, needConsent, async (req, res, next) => {
    try {
      const childId = Number(req.params.childId);
      if (!Number.isInteger(childId) || childId < 1) {
        res.status(400).json({ error: 'Invalid child profile.' });
        return;
      }

      const deleted = await db
        .delete(childrenTable)
        .where(and(eq(childrenTable.id, childId), eq(childrenTable.parentId, parentId(req))))
        .returning({ id: childrenTable.id });

      if (!deleted.length) {
        res.status(404).json({ error: 'Child profile not found.' });
        return;
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.post('/sessions', requireParent, needConsent, async (req, res, next) => {
    try {
      const parsed = SessionInput.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'The session results were not valid.' });
        return;
      }

      const [child] = await db
        .select({ id: childrenTable.id })
        .from(childrenTable)
        .where(and(eq(childrenTable.id, parsed.data.childId), eq(childrenTable.parentId, parentId(req))));

      if (!child) {
        res.status(400).json({ error: 'Choose a child before saving results.' });
        return;
      }

      const [session] = await db
        .insert(sessionsTable)
        .values({
          parentId: parentId(req),
          childId: parsed.data.childId,
          mathsCorrect: parsed.data.mathsCorrect,
          mathsTotal: parsed.data.mathsTotal,
          englishCorrect: parsed.data.englishCorrect,
          englishTotal: parsed.data.englishTotal,
          stars: parsed.data.stars,
          skills: parsed.data.skills,
        })
        .returning();

      res.status(201).json(serializeSession(session));
    } catch (error) {
      next(error);
    }
  });

  router.post('/transcribe', requireParent, needConsent, async (req, res, next) => {
    try {
      const parsed = TranscribeInput.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Send a short recording to match an answer.' });
        return;
      }

      const transcript = await transcribeAudio({
        audioBase64: parsed.data.audioBase64,
        mimeType: parsed.data.mimeType,
        fileName: parsed.data.fileName,
        choices: parsed.data.choices,
      });
      const match = matchSpokenAnswer(transcript, parsed.data.choices);
      console.log(
        '[transcribe] result',
        JSON.stringify({
          transcript,
          match,
          choices: parsed.data.choices,
        }),
      );

      res.json({
        transcript,
        match,
      });
    } catch (error) {
      if (error instanceof Error) {
        console.error('[transcribe]', error.message);
        res.status(502).json({ error: error.message });
        return;
      }
      console.error('[transcribe]', error);
      next(error);
    }
  });

  router.get('/children/:childId/progress', requireParent, needConsent, async (req, res, next) => {
    try {
      const childId = Number(req.params.childId);
      if (!Number.isInteger(childId) || childId < 1) {
        res.status(400).json({ error: 'Invalid child profile.' });
        return;
      }

      const [child] = await db
        .select()
        .from(childrenTable)
        .where(and(eq(childrenTable.id, childId), eq(childrenTable.parentId, parentId(req))));

      if (!child) {
        res.status(404).json({ error: 'Child profile not found.' });
        return;
      }

      const sessions = await db
        .select()
        .from(sessionsTable)
        .where(and(eq(sessionsTable.childId, childId), eq(sessionsTable.parentId, parentId(req))))
        .orderBy(desc(sessionsTable.completedAt))
        .limit(30);

      const [summary] = await db
        .select({
          totalStars: sql<number>`coalesce(sum(${sessionsTable.stars}), 0)::int`,
        })
        .from(sessionsTable)
        .where(and(eq(sessionsTable.childId, childId), eq(sessionsTable.parentId, parentId(req))));

      res.json({
        child: serializeChild(child),
        totalStars: summary?.totalStars ?? 0,
        latestSession: sessions[0] ? serializeSession(sessions[0]) : null,
        sessions: sessions.map(serializeSession),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
