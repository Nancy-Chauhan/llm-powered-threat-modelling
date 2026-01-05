import Anthropic from '@anthropic-ai/sdk';
import { db, threatModels, contextFiles } from '../db';
import { eq } from 'drizzle-orm';
import { readFile } from 'fs/promises';
import type { ThreatModelSelect, ContextFileSelect } from '../db/schema';
import type { MessageParam, ContentBlockParam } from '@anthropic-ai/sdk/resources/messages';

const anthropic = new Anthropic();

interface GeneratedThreat {
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
  mitigations: {
    id: string;
    description: string;
    priority: 'immediate' | 'short_term' | 'long_term';
    effort: 'low' | 'medium' | 'high';
    status: 'proposed';
  }[];
}

interface GenerationResult {
  threats: GeneratedThreat[];
  summary: string;
  recommendations: string[];
}

// Build text context from threat model metadata
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

// Convert file to Claude content block
async function fileToContentBlock(file: ContextFileSelect): Promise<ContentBlockParam | null> {
  try {
    const fileData = await readFile(file.storagePath);
    const base64Data = fileData.toString('base64');
    const mimeType = file.mimeType;

    // Handle images
    if (mimeType.startsWith('image/')) {
      const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
      if (validImageTypes.includes(mimeType as any)) {
        return {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: base64Data,
          },
        };
      }
    }

    // Handle PDFs - Claude supports PDF natively
    if (mimeType === 'application/pdf') {
      return {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: base64Data,
        },
      } as ContentBlockParam;
    }

    // Handle text files - read and include as text
    if (mimeType.startsWith('text/') ||
        mimeType === 'application/json' ||
        file.originalName.endsWith('.md') ||
        file.originalName.endsWith('.txt')) {
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
    console.error(`Error reading file ${file.originalName}:`, error);
    return null;
  }
}

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

    const files = await db
      .select()
      .from(contextFiles)
      .where(eq(contextFiles.threatModelId, threatModelId));

    // Build multimodal content array
    const contentBlocks: ContentBlockParam[] = [];

    // Add text context first
    const textContext = buildTextContext(model);
    contentBlocks.push({
      type: 'text',
      text: textContext,
    });

    // Add file context description
    if (files.length > 0) {
      contentBlocks.push({
        type: 'text',
        text: `\n## Uploaded Context Files (${files.length} files)\nThe following files have been uploaded for analysis:\n${files.map(f => `- ${f.originalName} (${f.fileType})`).join('\n')}\n\nPlease analyze these files to understand the system architecture, data flows, and potential security concerns:\n`,
      });
    }

    // Convert and add each file as content block
    for (const file of files) {
      const contentBlock = await fileToContentBlock(file);
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
      text: '\n\nBased on all the information provided above (system description, questionnaire responses, and uploaded documents/diagrams), please analyze this system and generate a threat model with the top 5 most critical security threats.',
    });

    // Call Claude API with multimodal content
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: contentBlocks,
        },
      ],
      system: SYSTEM_PROMPT,
    });

    // Parse response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    let result: GenerationResult;
    try {
      result = JSON.parse(responseText);
    } catch {
      // Try to extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse AI response as JSON');
      }
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
