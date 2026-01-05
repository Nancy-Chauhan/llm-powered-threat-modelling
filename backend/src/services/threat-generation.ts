import Anthropic from '@anthropic-ai/sdk';
import { db, threatModels, contextFiles } from '../db';
import { eq } from 'drizzle-orm';
import type { ThreatModelSelect, ContextFileSelect } from '../db/schema';

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

function buildPrompt(
  threatModel: ThreatModelSelect,
  files: ContextFileSelect[]
): string {
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

  if (files.length > 0) {
    context += `## Uploaded Context Files\n`;
    for (const file of files) {
      context += `- ${file.originalName} (${file.fileType})\n`;
      if (file.extractedText) {
        context += `  Content: ${file.extractedText.substring(0, 2000)}...\n`;
      }
    }
    context += '\n';
  }

  return context;
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

    const context = buildPrompt(model, files);

    // Call Claude API
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `${context}\n\nPlease analyze this system and generate a threat model with the top 5 most critical security threats.`,
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
