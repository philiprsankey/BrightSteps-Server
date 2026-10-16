import { integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export type StoredSkillResult = {
  name: string;
  correct: number;
  total: number;
  percentage: number;
};

export const childrenTable = pgTable('children', {
  id: serial('id').primaryKey(),
  // Null = pre-auth / unclaimed. Family routes never return these.
  parentId: text('parent_id'),
  name: text('name').notNull(),
  age: integer('age').notNull(),
  buddyId: text('buddy_id').notNull().default('dino'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessionsTable = pgTable('learning_sessions', {
  id: serial('id').primaryKey(),
  parentId: text('parent_id'),
  childId: integer('child_id')
    .notNull()
    .references(() => childrenTable.id, { onDelete: 'cascade' }),
  completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
  mathsCorrect: integer('maths_correct').notNull(),
  mathsTotal: integer('maths_total').notNull(),
  englishCorrect: integer('english_correct').notNull(),
  englishTotal: integer('english_total').notNull(),
  stars: integer('stars').notNull(),
  skills: jsonb('skills').$type<StoredSkillResult[]>().notNull().default([]),
});

export const parentConsentsTable = pgTable('parent_consents', {
  parentId: text('parent_id').primaryKey(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull().defaultNow(),
});
