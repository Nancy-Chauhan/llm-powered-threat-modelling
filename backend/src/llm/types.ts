/**
 * LLM Provider Abstraction Types
 *
 * This module defines the interfaces for LLM providers, allowing easy switching
 * between different providers (OpenAI, Anthropic, etc.) without changing business logic.
 */

// =============================================================================
// Content Block Types (Provider-agnostic)
// =============================================================================

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  /** URL to the image file */
  url: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
}

export interface DocumentContent {
  type: 'document';
  /** URL to the document file */
  url: string;
  mimeType: 'application/pdf';
  filename?: string;
}

export type ContentBlock = TextContent | ImageContent | DocumentContent;

// =============================================================================
// Message Types
// =============================================================================

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentBlock[];
}

// =============================================================================
// Request/Response Types
// =============================================================================

export interface LLMRequest {
  messages: Message[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: 'text' | 'json';
}

export interface LLMResponse {
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason?: 'stop' | 'length' | 'error';
}

// =============================================================================
// Provider Interface
// =============================================================================

export interface LLMProvider {
  /**
   * Provider name for identification
   */
  readonly name: string;

  /**
   * Send a completion request to the LLM
   */
  complete(request: LLMRequest): Promise<LLMResponse>;

  /**
   * Check if the provider supports a specific content type
   */
  supportsContentType(type: ContentBlock['type']): boolean;

  /**
   * Get supported image MIME types
   */
  getSupportedImageTypes(): string[];

  /**
   * Check if provider supports PDF documents
   */
  supportsPDF(): boolean;
}

// =============================================================================
// Provider Configuration
// =============================================================================

export type ProviderType = 'openai' | 'anthropic';

export interface ProviderConfig {
  provider: ProviderType;
  apiKey?: string; // Optional, can use env vars
  model?: string;
  baseUrl?: string; // For custom endpoints
  defaultMaxTokens?: number;
  defaultTemperature?: number;
}

export interface OpenAIConfig extends ProviderConfig {
  provider: 'openai';
  model?: string; // e.g., 'gpt-4o', 'gpt-4-turbo'
}

export interface AnthropicConfig extends ProviderConfig {
  provider: 'anthropic';
  model?: string; // e.g., 'claude-sonnet-4-20250514'
}

// =============================================================================
// Threat Model Generation Types
// =============================================================================

export interface ThreatGenerationInput {
  title: string;
  description?: string;
  systemDescription?: string;
  questionsAnswers: Array<{
    questionId: string;
    question: string;
    answer: string;
    category?: string;
  }>;
  files: Array<{
    originalName: string;
    fileType: string;
    storagePath: string;
    mimeType: string;
  }>;
}

export interface GeneratedThreat {
  id: string;
  title: string;
  description: string;
  category: 'spoofing' | 'tampering' | 'repudiation' | 'information_disclosure' | 'denial_of_service' | 'elevation_of_privilege';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  likelihood: number;
  impact: number;
  riskScore: number;
  affectedComponents: string[];
  attackVector?: string;
  mitigations: Array<{
    id: string;
    description: string;
    priority: 'immediate' | 'short_term' | 'long_term';
    effort: 'low' | 'medium' | 'high';
    status: 'proposed';
  }>;
}

export interface ThreatGenerationResult {
  threats: GeneratedThreat[];
  summary: string;
  recommendations: string[];
}
