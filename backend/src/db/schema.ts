import {
  sqliteTable,
  text,
  integer,
} from 'drizzle-orm/sqlite-core';

// Enums (handled as arrays for application-level validation if needed, Drizzle SQLite doesn't enforce DB-level enums like Postgres)
export const threatModelStatusEnum = [
  'draft',
  'generating',
  'completed',
  'failed',
] as const;

export const riskSeverityEnum = [
  'critical',
  'high',
  'medium',
  'low',
  'info',
] as const;

export const fileTypeEnum = [
  'prd',
  'diagram',
  'screenshot',
  'other',
] as const;

export const oauthProviderEnum = [
  'google_drive',
] as const;

// Threat Models table
export const threatModels = sqliteTable('threat_models', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status', { enum: threatModelStatusEnum }).notNull().default('draft'),
  organizationId: text('organization_id').notNull().default('default'),
  createdBy: text('created_by').notNull().default('anonymous'),
  userId: text('user_id'), // Clerk user ID

  // Context data
  systemDescription: text('system_description'),
  questionsAnswers: text('questions_answers', { mode: 'json' }).$type<QuestionAnswer[]>().$defaultFn(() => []),

  // Generated content
  threats: text('threats', { mode: 'json' }).$type<Threat[]>().$defaultFn(() => []),
  summary: text('summary'),
  recommendations: text('recommendations', { mode: 'json' }).$type<string[]>().$defaultFn(() => []),

  // Sharing
  shareToken: text('share_token').unique(),
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(false),

  // Generation metadata
  generationStartedAt: integer('generation_started_at', { mode: 'timestamp' }),
  generationCompletedAt: integer('generation_completed_at', { mode: 'timestamp' }),
  generationError: text('generation_error'),

  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Context Files table
export const contextFiles = sqliteTable('context_files', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  threatModelId: text('threat_model_id')
    .notNull()
    .references(() => threatModels.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  fileType: text('file_type', { enum: fileTypeEnum }).notNull().default('other'),
  storagePath: text('storage_path').notNull(),
  extractedText: text('extracted_text'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// JIRA Tickets table
export const jiraTickets = sqliteTable('jira_tickets', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  threatModelId: text('threat_model_id')
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
  labels: text('labels', { mode: 'json' }).$type<string[]>().$defaultFn(() => []),

  // People
  reporter: text('reporter', { mode: 'json' }).$type<{ displayName: string; email?: string } | null>(),
  assignee: text('assignee', { mode: 'json' }).$type<{ displayName: string; email?: string } | null>(),

  // Related data as JSON
  comments: text('comments', { mode: 'json' }).$type<JiraComment[]>().$defaultFn(() => []),
  attachments: text('attachments', { mode: 'json' }).$type<JiraAttachment[]>().$defaultFn(() => []),
  linkedIssues: text('linked_issues', { mode: 'json' }).$type<JiraLinkedIssue[]>().$defaultFn(() => []),
  remoteLinks: text('remote_links', { mode: 'json' }).$type<JiraRemoteLink[]>().$defaultFn(() => []),

  // Timestamps
  jiraCreatedAt: text('jira_created_at'),
  jiraUpdatedAt: text('jira_updated_at'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// User Usage table
export const userUsage = sqliteTable('user_usage', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().unique(),
  generationsUsed: integer('generations_used').notNull().default(0),
  generationsLimit: integer('generations_limit').notNull().default(5),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// OAuth Tokens table
export const oauthTokens = sqliteTable('oauth_tokens', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  provider: text('provider', { enum: oauthProviderEnum }).notNull(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  scope: text('scope'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
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
export type OAuthTokenInsert = typeof oauthTokens.$inferInsert;
export type OAuthTokenSelect = typeof oauthTokens.$inferSelect;
export type UserUsageInsert = typeof userUsage.$inferInsert;
export type UserUsageSelect = typeof userUsage.$inferSelect;
