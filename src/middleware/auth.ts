import { createClient, type User } from '@supabase/supabase-js';
import type { NextFunction, Request, Response } from 'express';

let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (supabase) return supabase;
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey || url.includes('YOUR_') || anonKey.includes('YOUR_')) {
    throw new Error('Set SUPABASE_URL and SUPABASE_ANON_KEY in server/.env');
  }
  supabase = createClient(url, anonKey);
  return supabase;
}

export function parentId(req: Request): string {
  return req.parentId!;
}

export async function requireParent(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) {
      res.status(401).json({ error: 'Sign in as a parent to continue.' });
      return;
    }

    const { data, error } = await getSupabase().auth.getUser(token);
    if (error || !data.user) {
      res.status(401).json({ error: 'Sign in as a parent to continue.' });
      return;
    }

    req.parentId = data.user.id;
    req.parentUser = data.user;
    next();
  } catch (error) {
    next(error);
  }
}

declare global {
  namespace Express {
    interface Request {
      parentId?: string;
      parentUser?: User;
    }
  }
}
