import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core';

// Enums
export const threatModelStatusEnum = pgEnum('threat_model_status', [
  'draft',
  'generating',
  'completed',
  'failed',
]);

export const riskSeverityEnum = pgEnum('risk_severity', [
  'critical',
  'high',
  'medium',
  'low',
  'info',
]);

export const fileTypeEnum = pgEnum('file_type', [
  'prd',
  'diagram',
  'screenshot',
  'other',
]);

// Threat Models table
export const threatModels = pgTable('threat_models', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  status: threatModelStatusEnum('status').notNull().default('draft'),
  organizationId: text('organization_id').notNull().default('default'),
  createdBy: text('created_by').notNull().default('anonymous'),

  // Context data
  systemDescription: text('system_description'),
  questionsAnswers: jsonb('questions_answers').$type<QuestionAnswer[]>().default([]),

  // Generated content
  threats: jsonb('threats').$type<Threat[]>().default([]),
  summary: text('summary'),
  recommendations: jsonb('recommendations').$type<string[]>().default([]),

  // Sharing
  shareToken: text('share_token').unique(),
  isPublic: boolean('is_public').notNull().default(false),

  // Generation metadata
  generationStartedAt: timestamp('generation_started_at', { withTimezone: true }),
  generationCompletedAt: timestamp('generation_completed_at', { withTimezone: true }),
  generationError: text('generation_error'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Context Files table
export const contextFiles = pgTable('context_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  threatModelId: uuid('threat_model_id')
    .notNull()
    .references(() => threatModels.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  fileType: fileTypeEnum('file_type').notNull().default('other'),
  storagePath: text('storage_path').notNull(),
  extractedText: text('extracted_text'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// JIRA Tickets table - stores JIRA ticket context for threat models
export const jiraTickets = pgTable('jira_tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  threatModelId: uuid('threat_model_id')
    .notNull()
    .references(() => threatModels.id, { onDelete: 'cascade' }),

  // JIRA identifiers
  issueKey: text('issue_key').notNull(),
  projectKey: text('project_key').notNull(),

  // Ticket data
  title: text('title').notNull(),
  description: text('description'),
  issueType: text('issue_type').notNull(),
  status: text('status').notNull(),
  priority: text('priority'),
  labels: jsonb('labels').$type<string[]>().default([]),

  // People
  reporter: jsonb('reporter').$type<{ displayName: string; email?: string } | null>(),
  assignee: jsonb('assignee').$type<{ displayName: string; email?: string } | null>(),

  // Related data as JSON
  comments: jsonb('comments').$type<JiraComment[]>().default([]),
  attachments: jsonb('attachments').$type<JiraAttachment[]>().default([]),
  linkedIssues: jsonb('linked_issues').$type<JiraLinkedIssue[]>().default([]),
  remoteLinks: jsonb('remote_links').$type<JiraRemoteLink[]>().default([]),

  // Timestamps
  jiraCreatedAt: text('jira_created_at'),
  jiraUpdatedAt: text('jira_updated_at'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Type definitions for JSONB columns
interface QuestionAnswer {
  questionId: string;
  question: string;
  answer: string;
  category?: string;
}

interface JiraComment {
  id: string;
  author: string;
  body: string;
  created: string;
}

interface JiraAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
}

interface JiraLinkedIssue {
  issueKey: string;
  title: string;
  linkType: string;
  direction: 'inward' | 'outward';
}

interface JiraRemoteLink {
  title: string;
  url: string;
}

interface Mitigation {
  id: string;
  description: string;
  priority: 'immediate' | 'short_term' | 'long_term';
  effort: 'low' | 'medium' | 'high';
  status: 'proposed' | 'accepted' | 'implemented' | 'rejected';
}

interface Threat {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  likelihood: number;
  impact: number;
  riskScore: number;
  affectedComponents: string[];
  attackVector?: string;
  mitigations: Mitigation[];
}

// Export types
export type ThreatModelInsert = typeof threatModels.$inferInsert;
export type ThreatModelSelect = typeof threatModels.$inferSelect;
export type ContextFileInsert = typeof contextFiles.$inferInsert;
export type ContextFileSelect = typeof contextFiles.$inferSelect;
export type JiraTicketInsert = typeof jiraTickets.$inferInsert;
export type JiraTicketSelect = typeof jiraTickets.$inferSelect;
