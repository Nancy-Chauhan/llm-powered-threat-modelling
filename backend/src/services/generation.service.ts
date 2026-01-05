import Anthropic from '@anthropic-ai/sdk';
import { threatModelService } from './threat-model.service';
import { fileService } from './file.service';
import { nanoid } from 'nanoid';
import {
  GUIDED_QUESTIONS,
  calculateRiskScore,
  getRiskSeverityFromScore,
  type QuestionAnswer,
} from '@threat-modeling/shared';

const anthropic = new Anthropic();

// In-memory job tracking (in production, use Redis or DB)
const generationJobs = new Map<string, {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  message?: string;
  error?: string;
}>();

export class GenerationService {
  async startGeneration(threatModelId: string): Promise<string> {
    const model = await threatModelService.getById(threatModelId);
    if (!model) {
      throw new Error('Threat model not found');
    }

    // Update status to generating
    await threatModelService.updateStatus(threatModelId, 'generating');

    // Start async generation
    this.runGeneration(threatModelId).catch((err) => {
      console.error('Generation failed:', err);
      threatModelService.updateStatus(threatModelId, 'failed', err.message);
      generationJobs.set(threatModelId, {
        status: 'failed',
        progress: 0,
        error: err.message,
      });
    });

    generationJobs.set(threatModelId, {
      status: 'processing',
      progress: 10,
      message: 'Starting threat analysis...',
    });

    return threatModelId;
  }

  getJobStatus(threatModelId: string) {
    return generationJobs.get(threatModelId) ?? {
      status: 'queued' as const,
      progress: 0,
    };
  }

  private async runGeneration(threatModelId: string): Promise<void> {
    const model = await threatModelService.getById(threatModelId);
    if (!model) throw new Error('Threat model not found');

    generationJobs.set(threatModelId, {
      status: 'processing',
      progress: 20,
      message: 'Analyzing system context...',
    });

    // Build context from all inputs
    const context = await this.buildContext(model);

    generationJobs.set(threatModelId, {
      status: 'processing',
      progress: 40,
      message: 'Generating threat analysis...',
    });

    // Generate threats using Claude
    const result = await this.generateThreatsWithAI(context);

    generationJobs.set(threatModelId, {
      status: 'processing',
      progress: 80,
      message: 'Finalizing threat model...',
    });

    // Update the threat model with results
    await threatModelService.updateThreats(
      threatModelId,
      result.threats,
      result.summary,
      result.recommendations
    );
    await threatModelService.updateStatus(threatModelId, 'completed');

    generationJobs.set(threatModelId, {
      status: 'completed',
      progress: 100,
      message: 'Threat model generated successfully',
    });
  }

  private async buildContext(model: any): Promise<string> {
    const parts: string[] = [];

    // Add title and description
    parts.push(`# ${model.title}`);
    if (model.description) {
      parts.push(`\n## Description\n${model.description}`);
    }

    // Add system description
    if (model.systemDescription) {
      parts.push(`\n## System Description\n${model.systemDescription}`);
    }

    // Add questionnaire answers
    if (model.questionsAnswers && model.questionsAnswers.length > 0) {
      parts.push('\n## Security Questionnaire Responses');
      for (const qa of model.questionsAnswers as QuestionAnswer[]) {
        const question = GUIDED_QUESTIONS.find((q) => q.id === qa.questionId);
        parts.push(`\n### ${question?.question ?? qa.question}`);
        parts.push(qa.answer);
      }
    }

    // Add extracted text from files
    if (model.contextFiles && model.contextFiles.length > 0) {
      parts.push('\n## Uploaded Context Files');
      for (const file of model.contextFiles) {
        const extractedText = await fileService.getExtractedText(file.id);
        if (extractedText) {
          parts.push(`\n### ${file.originalName} (${file.fileType})`);
          parts.push(extractedText);
        }
      }
    }

    return parts.join('\n');
  }

  private async generateThreatsWithAI(context: string): Promise<{
    threats: any[];
    summary: string;
    recommendations: string[];
  }> {
    const systemPrompt = `You are a senior security architect performing threat modeling using the STRIDE methodology.
Your task is to analyze the provided system context and identify the TOP 5 most critical security threats.

For each threat, provide:
1. A clear, concise title
2. Detailed description of the threat
3. STRIDE category (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege)
4. Likelihood (1-5 scale)
5. Impact (1-5 scale)
6. Affected components
7. Attack vector description
8. 2-3 specific, actionable mitigations

Focus on the most impactful and realistic threats based on the system description.

Respond in JSON format with the following structure:
{
  "summary": "Executive summary of the threat landscape",
  "threats": [
    {
      "title": "Threat title",
      "description": "Detailed description",
      "category": "spoofing|tampering|repudiation|information_disclosure|denial_of_service|elevation_of_privilege",
      "likelihood": 1-5,
      "impact": 1-5,
      "affectedComponents": ["component1", "component2"],
      "attackVector": "Description of how the attack would be carried out",
      "mitigations": [
        {
          "description": "Specific mitigation action",
          "priority": "immediate|short_term|long_term",
          "effort": "low|medium|high"
        }
      ]
    }
  ],
  "recommendations": ["General security recommendation 1", "General security recommendation 2"]
}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Please analyze the following system and generate a threat model:\n\n${context}`,
        },
      ],
      system: systemPrompt,
    });

    // Extract text content
    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from AI');
    }

    // Parse JSON response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse AI response as JSON');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Transform and enrich threats
    const threats = parsed.threats.map((t: any, index: number) => {
      const riskScore = calculateRiskScore(t.likelihood, t.impact);
      return {
        id: nanoid(),
        title: t.title,
        description: t.description,
        category: t.category,
        severity: getRiskSeverityFromScore(riskScore),
        likelihood: t.likelihood,
        impact: t.impact,
        riskScore,
        affectedComponents: t.affectedComponents ?? [],
        attackVector: t.attackVector,
        mitigations: (t.mitigations ?? []).map((m: any) => ({
          id: nanoid(),
          description: m.description,
          priority: m.priority ?? 'short_term',
          effort: m.effort ?? 'medium',
          status: 'proposed',
        })),
      };
    });

    // Sort by risk score descending and take top 5
    threats.sort((a: any, b: any) => b.riskScore - a.riskScore);
    const top5 = threats.slice(0, 5);

    return {
      threats: top5,
      summary: parsed.summary ?? '',
      recommendations: parsed.recommendations ?? [],
    };
  }
}

export const generationService = new GenerationService();
