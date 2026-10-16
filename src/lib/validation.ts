import { z } from 'zod';

export const BuddyId = z.enum(['dino', 'dragon', 'foxy', 'robo', 'super', 'teddy']);

export const ChildInput = z.object({
  name: z.string().trim().min(1).max(30),
  age: z.number().int().min(3).max(7),
  buddyId: BuddyId.default('dino'),
});

export const ChildUpdateInput = z.object({
  buddyId: BuddyId,
});

export const TranscribeInput = z.object({
  audioBase64: z.string().min(1),
  mimeType: z.string().min(3).max(80).default('audio/m4a'),
  choices: z.array(z.string().min(1).max(40)).min(1).max(6),
});

export const SkillResult = z.object({
  name: z.string().min(1),
  correct: z.number().int().min(0),
  total: z.number().int().min(0),
  percentage: z.number().int().min(0).max(100),
});

export const SessionInput = z.object({
  childId: z.number().int().min(1),
  mathsCorrect: z.number().int().min(0),
  mathsTotal: z.number().int().min(0),
  englishCorrect: z.number().int().min(0),
  englishTotal: z.number().int().min(0),
  stars: z.number().int().min(0),
  skills: z.array(SkillResult),
});

export function serializeChild(child: {
  id: number;
  name: string;
  age: number;
  buddyId?: string | null;
  createdAt: Date;
}) {
  return {
    id: String(child.id),
    name: child.name,
    age: child.age,
    buddyId: child.buddyId ?? 'dino',
    createdAt: child.createdAt.toISOString(),
  };
}

export function serializeSession(session: {
  id: number;
  childId: number;
  completedAt: Date;
  mathsCorrect: number;
  mathsTotal: number;
  englishCorrect: number;
  englishTotal: number;
  stars: number;
  skills: unknown;
}) {
  return {
    id: String(session.id),
    childId: String(session.childId),
    completedAt: session.completedAt.toISOString(),
    mathsCorrect: session.mathsCorrect,
    mathsTotal: session.mathsTotal,
    englishCorrect: session.englishCorrect,
    englishTotal: session.englishTotal,
    stars: session.stars,
    skills: session.skills,
  };
}
