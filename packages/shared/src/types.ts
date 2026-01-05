// ============================================================================
// Threat Model Dashboard - Core Types
// ============================================================================

// Risk severity levels
export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

// Threat model status
export type ThreatModelStatus =
  | 'draft'           // Initial creation, gathering context
  | 'processing'      // AI generation in progress
  | 'generated'       // Generation complete, pending review
  | 'reviewed'        // Human reviewed and approved
  | 'archived';       // No longer active

// File attachment types
export type AttachmentType = 'prd' | 'diagram' | 'screenshot' | 'other';

// ============================================================================
// Core Entities
// ============================================================================

export interface ThreatModel {
  id: string;
  title: string;
  description: string;
  status: ThreatModelStatus;

  // Context inputs
  context: ThreatModelContext;

  // Guided questions & answers
  questionnaire: QuestionnaireResponse[];

  // Generated output
  threats: Threat[];
  overallRiskScore: number | null;
  summary: string | null;

  // Sharing
  shareToken: string | null;
  isPublic: boolean;

  // Metadata
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  generatedAt: string | null;
}

export interface ThreatModelContext {
  // Text inputs
  projectName: string;
  projectDescription: string;
  techStack: string[];
  dataClassification: DataClassification;
  deploymentEnvironment: DeploymentEnvironment;

  // File attachments
  attachments: Attachment[];

  // Additional context
  existingControls: string;
  complianceRequirements: string[];
  additionalNotes: string;
}

export type DataClassification =
  | 'public'
  | 'internal'
  | 'confidential'
  | 'restricted';

export type DeploymentEnvironment =
  | 'cloud-public'
  | 'cloud-private'
  | 'on-premise'
  | 'hybrid'
  | 'edge';

export interface Attachment {
  id: string;
  threatModelId: string;
  type: AttachmentType;
  filename: string;
  mimeType: string;
  size: number;
  storageKey: string;
  uploadedAt: string;
}

// ============================================================================
// Questionnaire
// ============================================================================

export interface Question {
  id: string;
  category: QuestionCategory;
  text: string;
  helpText?: string;
  inputType: 'text' | 'textarea' | 'select' | 'multiselect' | 'boolean';
  options?: string[];
  required: boolean;
  order: number;
}

export type QuestionCategory =
  | 'authentication'
  | 'authorization'
  | 'data-handling'
  | 'network'
  | 'infrastructure'
  | 'third-party'
  | 'compliance';

export interface QuestionnaireResponse {
  questionId: string;
  answer: string | string[] | boolean;
}

// ============================================================================
// Threats & Risks
// ============================================================================

export interface Threat {
  id: string;
  threatModelId: string;
  rank: number; // 1-5 for top 5

  // Threat details
  title: string;
  description: string;
  category: ThreatCategory;

  // STRIDE classification
  strideCategory: StrideCategory[];

  // Risk assessment
  likelihood: RiskLevel;
  impact: RiskLevel;
  riskScore: number; // Calculated: likelihood * impact (1-25)
  severity: RiskSeverity;

  // Mitigations
  mitigations: Mitigation[];

  // Affected components
  affectedAssets: string[];
  attackVector: string;

  // References
  references: string[];
}

export type ThreatCategory =
  | 'injection'
  | 'authentication'
  | 'authorization'
  | 'data-exposure'
  | 'misconfiguration'
  | 'vulnerable-components'
  | 'logging-monitoring'
  | 'ssrf'
  | 'business-logic'
  | 'other';

export type StrideCategory =
  | 'spoofing'
  | 'tampering'
  | 'repudiation'
  | 'information-disclosure'
  | 'denial-of-service'
  | 'elevation-of-privilege';

export type RiskLevel = 1 | 2 | 3 | 4 | 5;

export interface Mitigation {
  id: string;
  threatId: string;
  title: string;
  description: string;
  priority: 'immediate' | 'short-term' | 'long-term';
  effort: 'low' | 'medium' | 'high';
  status: 'proposed' | 'in-progress' | 'implemented' | 'accepted-risk';
}

// ============================================================================
// Generation Job
// ============================================================================

export interface GenerationJob {
  id: string;
  threatModelId: string;
  status: GenerationStatus;
  progress: number; // 0-100
  currentStep: string | null;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
}

export type GenerationStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed';

// ============================================================================
// Escalation Rules
// ============================================================================

export interface EscalationRule {
  id: string;
  name: string;
  condition: EscalationCondition;
  actions: EscalationAction[];
  enabled: boolean;
}

export interface EscalationCondition {
  type: 'risk-score' | 'severity' | 'category';
  operator: 'gte' | 'lte' | 'eq' | 'contains';
  value: number | string | string[];
}

export interface EscalationAction {
  type: 'notify' | 'require-approval' | 'block-deployment';
  config: Record<string, unknown>;
}

// ============================================================================
// Share & Export
// ============================================================================

export interface ShareSettings {
  threatModelId: string;
  isPublic: boolean;
  shareToken: string | null;
  expiresAt: string | null;
  allowedEmails: string[];
  permissions: SharePermission[];
}

export type SharePermission = 'view' | 'comment' | 'edit';

export interface ExportOptions {
  format: 'pdf' | 'json' | 'markdown';
  includeAttachments: boolean;
  includeMitigationStatus: boolean;
  includeReferences: boolean;
}
