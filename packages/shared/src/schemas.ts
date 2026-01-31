import { z } from 'zod';

// ============================================
// ENUMS
// ============================================

export const ThreatModelStatus = z.enum([
  'draft',
  'generating',
  'completed',
  'failed',
]);
export type ThreatModelStatus = z.infer<typeof ThreatModelStatus>;

export const RiskSeverity = z.enum(['critical', 'high', 'medium', 'low', 'info']);
export type RiskSeverity = z.infer<typeof RiskSeverity>;

export const RiskCategory = z.enum([
  'spoofing',
  'tampering',
  'repudiation',
  'information_disclosure',
  'denial_of_service',
  'elevation_of_privilege',
]);
export type RiskCategory = z.infer<typeof RiskCategory>;

export const FileType = z.enum(['prd', 'diagram', 'screenshot', 'other']);
export type FileType = z.infer<typeof FileType>;

// ============================================
// JIRA SCHEMAS
// ============================================

export const JiraCommentSchema = z.object({
  id: z.string(),
  author: z.string(),
  body: z.string(),
  created: z.string(),
});
export type JiraComment = z.infer<typeof JiraCommentSchema>;

export const JiraAttachmentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  size: z.number(),
  url: z.string(),
});
export type JiraAttachment = z.infer<typeof JiraAttachmentSchema>;

export const JiraLinkedIssueSchema = z.object({
  issueKey: z.string(),
  title: z.string(),
  linkType: z.string(),
  direction: z.enum(['inward', 'outward']),
});
export type JiraLinkedIssue = z.infer<typeof JiraLinkedIssueSchema>;

export const JiraRemoteLinkSchema = z.object({
  title: z.string(),
  url: z.string(),
});
export type JiraRemoteLink = z.infer<typeof JiraRemoteLinkSchema>;

export const JiraTicketSchema = z.object({
  id: z.string().uuid(),
  threatModelId: z.string().uuid(),
  issueKey: z.string(),
  projectKey: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  issueType: z.string(),
  status: z.string(),
  priority: z.string().nullable(),
  labels: z.array(z.string()),
  reporter: z.object({
    displayName: z.string(),
    email: z.string().optional(),
  }).nullable(),
  assignee: z.object({
    displayName: z.string(),
    email: z.string().optional(),
  }).nullable(),
  comments: z.array(JiraCommentSchema),
  attachments: z.array(JiraAttachmentSchema),
  linkedIssues: z.array(JiraLinkedIssueSchema),
  remoteLinks: z.array(JiraRemoteLinkSchema),
  jiraCreatedAt: z.string().nullable(),
  jiraUpdatedAt: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type JiraTicket = z.infer<typeof JiraTicketSchema>;

// ============================================
// CORE SCHEMAS
// ============================================

export const ContextFileSchema = z.object({
  id: z.string().uuid(),
  threatModelId: z.string().uuid(),
  filename: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number(),
  fileType: FileType,
  storagePath: z.string(),
  createdAt: z.string().datetime(),
});
export type ContextFile = z.infer<typeof ContextFileSchema>;

export const QuestionAnswerSchema = z.object({
  questionId: z.string(),
  question: z.string(),
  answer: z.string(),
  category: z.string().optional(),
});
export type QuestionAnswer = z.infer<typeof QuestionAnswerSchema>;

export const MitigationSchema = z.object({
  id: z.string().uuid(),
  description: z.string(),
  priority: z.enum(['immediate', 'short_term', 'long_term']),
  effort: z.enum(['low', 'medium', 'high']),
  status: z.enum(['proposed', 'accepted', 'implemented', 'rejected']),
});
export type Mitigation = z.infer<typeof MitigationSchema>;

export const ThreatSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  category: RiskCategory,
  severity: RiskSeverity,
  likelihood: z.number().min(1).max(5),
  impact: z.number().min(1).max(5),
  riskScore: z.number().min(1).max(25),
  affectedComponents: z.array(z.string()),
  attackVector: z.string().optional(),
  mitigations: z.array(MitigationSchema),
});
export type Threat = z.infer<typeof ThreatSchema>;

export const ThreatModelSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().optional(),
  status: ThreatModelStatus,
  organizationId: z.string(),
  createdBy: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),

  // Context data
  systemDescription: z.string().optional(),
  questionsAnswers: z.array(QuestionAnswerSchema),
  contextFiles: z.array(ContextFileSchema).optional(),
  jiraTickets: z.array(JiraTicketSchema).optional(),

  // Generated content
  threats: z.array(ThreatSchema),
  summary: z.string().optional(),
  recommendations: z.array(z.string()).optional(),

  // Sharing
  shareToken: z.string().optional(),
  isPublic: z.boolean().default(false),

  // Generation metadata
  generationStartedAt: z.string().datetime().optional(),
  generationCompletedAt: z.string().datetime().optional(),
  generationError: z.string().optional(),
});
export type ThreatModel = z.infer<typeof ThreatModelSchema>;

// ============================================
// GUIDED QUESTIONS
// ============================================

export const GuidedQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  helpText: z.string().optional(),
  category: z.string(),
  required: z.boolean().default(false),
  order: z.number(),
});
export type GuidedQuestion = z.infer<typeof GuidedQuestionSchema>;

export const GUIDED_QUESTIONS: GuidedQuestion[] = [
  {
    id: 'system_purpose',
    question: 'What is the primary purpose of this system/feature?',
    helpText: 'Describe what the system does and its main functionality.',
    category: 'Overview',
    required: true,
    order: 1,
  },
  {
    id: 'data_handled',
    question: 'What types of data does this system handle?',
    helpText: 'Include PII, financial data, credentials, health records, etc.',
    category: 'Data',
    required: true,
    order: 2,
  },
  {
    id: 'data_flow',
    question: 'How does data flow through the system?',
    helpText: 'Describe data entry points, processing, storage, and outputs.',
    category: 'Data',
    required: false,
    order: 3,
  },
  {
    id: 'users_actors',
    question: 'Who are the users and external actors?',
    helpText: 'List all user types, third-party integrations, and external systems.',
    category: 'Actors',
    required: true,
    order: 4,
  },
  {
    id: 'authentication',
    question: 'How is authentication handled?',
    helpText: 'Describe login methods, session management, and identity verification.',
    category: 'Security Controls',
    required: true,
    order: 5,
  },
  {
    id: 'authorization',
    question: 'How is authorization/access control implemented?',
    helpText: 'Describe roles, permissions, and access control mechanisms.',
    category: 'Security Controls',
    required: true,
    order: 6,
  },
  {
    id: 'trust_boundaries',
    question: 'What are the trust boundaries?',
    helpText: 'Where does trust change? (e.g., client/server, internal/external networks)',
    category: 'Architecture',
    required: false,
    order: 7,
  },
  {
    id: 'infrastructure',
    question: 'What infrastructure does this run on?',
    helpText: 'Cloud provider, containerization, databases, caching, etc.',
    category: 'Architecture',
    required: false,
    order: 8,
  },
  {
    id: 'external_dependencies',
    question: 'What external dependencies and integrations exist?',
    helpText: 'Third-party APIs, libraries, services, etc.',
    category: 'Dependencies',
    required: false,
    order: 9,
  },
  {
    id: 'known_concerns',
    question: 'Are there any known security concerns or past incidents?',
    helpText: 'Any previous vulnerabilities, security reviews, or areas of concern.',
    category: 'History',
    required: false,
    order: 10,
  },
];

// ============================================
// API CONTRACTS - REQUEST SCHEMAS
// ============================================

export const CreateThreatModelRequestSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  systemDescription: z.string().max(10000).optional(),
});
export type CreateThreatModelRequest = z.infer<typeof CreateThreatModelRequestSchema>;

export const UpdateThreatModelRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  systemDescription: z.string().max(10000).optional(),
  questionsAnswers: z.array(QuestionAnswerSchema).optional(),
  isPublic: z.boolean().optional(),
});
export type UpdateThreatModelRequest = z.infer<typeof UpdateThreatModelRequestSchema>;

export const GenerateThreatModelRequestSchema = z.object({
  threatModelId: z.string().uuid(),
});
export type GenerateThreatModelRequest = z.infer<typeof GenerateThreatModelRequestSchema>;

export const UploadContextFileRequestSchema = z.object({
  threatModelId: z.string().uuid(),
  fileType: FileType,
});
export type UploadContextFileRequest = z.infer<typeof UploadContextFileRequestSchema>;

export const UpdateThreatRequestSchema = z.object({
  severity: RiskSeverity.optional(),
  likelihood: z.number().min(1).max(5).optional(),
  impact: z.number().min(1).max(5).optional(),
});
export type UpdateThreatRequest = z.infer<typeof UpdateThreatRequestSchema>;

export const UpdateMitigationRequestSchema = z.object({
  status: z.enum(['proposed', 'accepted', 'implemented', 'rejected']).optional(),
  description: z.string().optional(),
});
export type UpdateMitigationRequest = z.infer<typeof UpdateMitigationRequestSchema>;

// ============================================
// API CONTRACTS - RESPONSE SCHEMAS
// ============================================

export const ThreatModelSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().optional(),
  status: ThreatModelStatus,
  threatCount: z.number(),
  highestSeverity: RiskSeverity.optional(),
  isShared: z.boolean().optional(),
  shareUrl: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ThreatModelSummary = z.infer<typeof ThreatModelSummarySchema>;

export const ThreatModelListResponseSchema = z.object({
  items: z.array(ThreatModelSummarySchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type ThreatModelListResponse = z.infer<typeof ThreatModelListResponseSchema>;

export const GenerationStatusResponseSchema = z.object({
  status: ThreatModelStatus,
  progress: z.number().min(0).max(100).optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});
export type GenerationStatusResponse = z.infer<typeof GenerationStatusResponseSchema>;

export const ShareLinkResponseSchema = z.object({
  shareUrl: z.string().url(),
  shareToken: z.string(),
  expiresAt: z.string().datetime().optional(),
});
export type ShareLinkResponse = z.infer<typeof ShareLinkResponseSchema>;

// ============================================
// RISK SCORING UTILITIES
// ============================================

export function calculateRiskScore(likelihood: number, impact: number): number {
  return likelihood * impact;
}

export function getRiskSeverityFromScore(score: number): RiskSeverity {
  if (score >= 20) return 'critical';
  if (score >= 15) return 'high';
  if (score >= 10) return 'medium';
  if (score >= 5) return 'low';
  return 'info';
}

export function shouldEscalate(threat: Threat): boolean {
  return threat.severity === 'critical' || threat.riskScore >= 20;
}

export const SEVERITY_COLORS: Record<RiskSeverity, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#2563eb',
  info: '#6b7280',
};

export const CATEGORY_LABELS: Record<RiskCategory, string> = {
  spoofing: 'Spoofing',
  tampering: 'Tampering',
  repudiation: 'Repudiation',
  information_disclosure: 'Information Disclosure',
  denial_of_service: 'Denial of Service',
  elevation_of_privilege: 'Elevation of Privilege',
};
