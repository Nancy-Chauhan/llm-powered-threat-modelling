import { db, threatModels, contextFiles, jiraTickets } from '../db';
import { eq } from 'drizzle-orm';
import type { ThreatModelSelect, ContextFileSelect, JiraTicketSelect } from '../db/schema';
import { buildJiraContext } from './jira.service';
import {
  getDefaultProvider,
  type LLMProvider,
  type ContentBlock,
  type ThreatGenerationResult,
} from '../llm';
import { getDefaultStorageProvider } from '../storage';

// =============================================================================
// System Prompt
// =============================================================================

const SYSTEM_PROMPT = `You are a senior security architect performing threat modeling using the STRIDE methodology.
Analyze the provided system information and generate a comprehensive threat model.

For each threat identified:
1. Classify using STRIDE categories (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege)
2. Assess severity (critical, high, medium, low, info)
3. Rate likelihood (1-5) and impact (1-5)
4. Calculate risk score (likelihood × impact)
5. Identify affected components
6. Describe attack vectors
7. Propose concrete mitigations with priority and effort estimates

Focus on the TOP 5 most critical threats. Be specific and actionable.

Respond with valid JSON only, no markdown code blocks, matching this structure:
{
  "threats": [
    {
      "id": "threat-uuid",
      "title": "Threat Title",
      "description": "Detailed description of the threat",
      "category": "spoofing|tampering|repudiation|information_disclosure|denial_of_service|elevation_of_privilege",
      "severity": "critical|high|medium|low|info",
      "likelihood": 1-5,
      "impact": 1-5,
      "riskScore": 1-25,
      "affectedComponents": ["component1", "component2"],
      "attackVector": "Description of how attack is carried out",
      "mitigations": [
        {
          "id": "mitigation-uuid",
          "description": "Specific mitigation action",
          "priority": "immediate|short_term|long_term",
          "effort": "low|medium|high",
          "status": "proposed"
        }
      ]
    }
  ],
  "summary": "Executive summary of the threat landscape",
  "recommendations": ["Top recommendation 1", "Top recommendation 2"]
}`;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build text context from threat model metadata
 */
function buildTextContext(threatModel: ThreatModelSelect): string {
  const questionsAnswers = threatModel.questionsAnswers as Array<{
    questionId: string;
    question: string;
    answer: string;
    category?: string;
  }>;

  let context = `# System Information\n\n`;

  if (threatModel.title) {
    context += `## Project: ${threatModel.title}\n\n`;
  }

  if (threatModel.description) {
    context += `## Description\n${threatModel.description}\n\n`;
  }

  if (threatModel.systemDescription) {
    context += `## System Description\n${threatModel.systemDescription}\n\n`;
  }

  if (questionsAnswers && questionsAnswers.length > 0) {
    context += `## Security Questionnaire Responses\n\n`;
    for (const qa of questionsAnswers) {
      context += `### ${qa.question}\n${qa.answer}\n\n`;
    }
  }

  return context;
}

/**
 * Convert file to provider-agnostic content block using storage URLs
 */
async function fileToContentBlock(
  file: ContextFileSelect,
  provider: LLMProvider
): Promise<ContentBlock | null> {
  try {
    const storage = getDefaultStorageProvider();
    const mimeType = file.mimeType;

    // Get URL for the file (signed URL for S3, public URL for local)
    // Use 1 hour expiry for signed URLs
    const fileUrl = await storage.getUrl(file.storagePath, 3600);

    // Handle images
    if (mimeType.startsWith('image/')) {
      const validImageTypes = provider.getSupportedImageTypes();
      if (validImageTypes.includes(mimeType)) {
        return {
          type: 'image',
          url: fileUrl,
          mimeType: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        };
      }
    }

    // Handle PDFs
    if (mimeType === 'application/pdf') {
      if (provider.supportsPDF()) {
        return {
          type: 'document',
          url: fileUrl,
          mimeType: 'application/pdf',
          filename: file.originalName,
        };
      } else {
        // Provider doesn't support PDF - warn and skip
        console.warn(
          `Provider ${provider.name} does not support PDFs. File "${file.originalName}" will be skipped.`
        );
        return null;
      }
    }

    // Handle text files - read content and include as text
    // Text files need to be read since they're embedded inline
    if (
      mimeType.startsWith('text/') ||
      mimeType === 'application/json' ||
      file.originalName.endsWith('.md') ||
      file.originalName.endsWith('.txt')
    ) {
      const fileData = await storage.get(file.storagePath);
      const textContent = fileData.toString('utf-8');
      return {
        type: 'text',
        text: `\n--- File: ${file.originalName} (${file.fileType}) ---\n${textContent}\n--- End of ${file.originalName} ---\n`,
      };
    }

    // Skip unsupported file types
    console.warn(`Unsupported file type: ${mimeType} for ${file.originalName}`);
    return null;
  } catch (error) {
    console.error(`Error processing file ${file.originalName}:`, error);
    return null;
  }
}

/**
 * Build context string from stored JIRA ticket data
 */
function buildJiraContextFromTicket(ticket: JiraTicketSelect): string {
  let context = `## JIRA Ticket: ${ticket.issueKey}\n\n`;
  context += `**Title:** ${ticket.title}\n`;
  context += `**Type:** ${ticket.issueType}\n`;
  context += `**Status:** ${ticket.status}\n`;
  context += `**Priority:** ${ticket.priority || 'Not set'}\n\n`;

  if (ticket.description) {
    context += `### Description\n${ticket.description}\n\n`;
  }

  const labels = (ticket.labels || []) as string[];
  if (labels.length > 0) {
    context += `**Labels:** ${labels.join(', ')}\n\n`;
  }

  const reporter = ticket.reporter as { displayName: string; email?: string } | null;
  const assignee = ticket.assignee as { displayName: string; email?: string } | null;

  if (reporter) {
    context += `**Reporter:** ${reporter.displayName}\n`;
  }
  if (assignee) {
    context += `**Assignee:** ${assignee.displayName}\n`;
  }
  context += '\n';

  // Add comments
  const comments = (ticket.comments || []) as Array<{ id: string; author: string; body: string; created: string }>;
  if (comments.length > 0) {
    context += `### Comments (${comments.length})\n\n`;
    for (const comment of comments) {
      context += `**${comment.author}** (${comment.created}):\n`;
      context += `${comment.body}\n\n`;
    }
  }

  // Add linked issues
  const linkedIssues = (ticket.linkedIssues || []) as Array<{ issueKey: string; title: string; linkType: string }>;
  if (linkedIssues.length > 0) {
    context += `### Linked Issues\n`;
    for (const link of linkedIssues) {
      context += `- ${link.linkType}: ${link.issueKey} - ${link.title}\n`;
    }
    context += '\n';
  }

  // Add external links
  const remoteLinks = (ticket.remoteLinks || []) as Array<{ title: string; url: string }>;
  if (remoteLinks.length > 0) {
    context += `### External Links\n`;
    for (const link of remoteLinks) {
      context += `- [${link.title}](${link.url})\n`;
    }
    context += '\n';
  }

  // Add attachments list
  const attachments = (ticket.attachments || []) as Array<{ filename: string; mimeType: string; size: number }>;
  if (attachments.length > 0) {
    context += `### Attachments\n`;
    for (const att of attachments) {
      context += `- ${att.filename} (${att.mimeType})\n`;
    }
    context += '\n';
  }

  return context;
}

/**
 * Parse the LLM response into structured result
 */
function parseResponse(responseText: string): ThreatGenerationResult {
  try {
    return JSON.parse(responseText);
  } catch {
    // Try to extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Failed to parse AI response as JSON');
  }
}

// =============================================================================
// Main Generation Function
// =============================================================================

/**
 * Generate threat model using the configured LLM provider
 */
export async function generateThreatModel(threatModelId: string): Promise<void> {
  // Mark as generating
  await db
    .update(threatModels)
    .set({
      status: 'generating',
      generationStartedAt: new Date(),
      generationError: null,
    })
    .where(eq(threatModels.id, threatModelId));

  try {
    // Fetch threat model and files
    const [model] = await db
      .select()
      .from(threatModels)
      .where(eq(threatModels.id, threatModelId));

    if (!model) {
      throw new Error('Threat model not found');
    }

    const [files, tickets] = await Promise.all([
      db.select().from(contextFiles).where(eq(contextFiles.threatModelId, threatModelId)),
      db.select().from(jiraTickets).where(eq(jiraTickets.threatModelId, threatModelId)),
    ]);

    // Get the LLM provider
    const provider = getDefaultProvider();
    console.log(`Using LLM provider: ${provider.name}`);

    // Build multimodal content array
    const contentBlocks: ContentBlock[] = [];

    // Add text context first
    const textContext = buildTextContext(model);
    contentBlocks.push({
      type: 'text',
      text: textContext,
    });

    // Add JIRA ticket context
    if (tickets.length > 0) {
      contentBlocks.push({
        type: 'text',
        text: `\n## JIRA Tickets (${tickets.length} tickets)\nThe following JIRA tickets provide context for this threat model:\n`,
      });

      for (const ticket of tickets) {
        // Build context from the stored JIRA data
        const jiraContext = buildJiraContextFromTicket(ticket);
        contentBlocks.push({
          type: 'text',
          text: jiraContext,
        });
      }
    }

    // Add file context description
    if (files.length > 0) {
      contentBlocks.push({
        type: 'text',
        text: `\n## Uploaded Context Files (${files.length} files)\nThe following files have been uploaded for analysis:\n${files.map((f) => `- ${f.originalName} (${f.fileType})`).join('\n')}\n\nPlease analyze these files to understand the system architecture, data flows, and potential security concerns:\n`,
      });
    }

    // Convert and add each file as content block
    for (const file of files) {
      const contentBlock = await fileToContentBlock(file, provider);
      if (contentBlock) {
        // Add a label before each file
        contentBlocks.push({
          type: 'text',
          text: `\n[Analyzing: ${file.originalName}]\n`,
        });
        contentBlocks.push(contentBlock);
      }
    }

    // Add the analysis request
    contentBlocks.push({
      type: 'text',
      text: '\n\nBased on all the information provided above (system description, JIRA tickets, questionnaire responses, and uploaded documents/diagrams), please analyze this system and generate a threat model with the top 5 most critical security threats.',
    });

    // Call LLM provider
    const response = await provider.complete({
      messages: [
        {
          role: 'user',
          content: contentBlocks,
        },
      ],
      systemPrompt: SYSTEM_PROMPT,
      maxTokens: 4096,
      temperature: 0,
    });

    // Parse response
    const result = parseResponse(response.content);

    // Log usage if available
    if (response.usage) {
      console.log(
        `LLM usage - Input: ${response.usage.inputTokens}, Output: ${response.usage.outputTokens}, Total: ${response.usage.totalTokens}`
      );
    }

    // Update threat model with results
    await db
      .update(threatModels)
      .set({
        status: 'completed',
        threats: result.threats,
        summary: result.summary,
        recommendations: result.recommendations,
        generationCompletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(threatModels.id, threatModelId));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await db
      .update(threatModels)
      .set({
        status: 'failed',
        generationError: errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(threatModels.id, threatModelId));

    throw error;
  }
}
