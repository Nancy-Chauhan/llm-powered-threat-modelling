import Anthropic from '@anthropic-ai/sdk';
import type {
  LLMProvider,
  LLMRequest,
  LLMResponse,
  ContentBlock,
  AnthropicConfig,
} from '../types';
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages';

/**
 * Anthropic Claude Provider
 *
 * Supports: text, images (JPEG, PNG, GIF, WebP), PDFs
 */
export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  private client: Anthropic;
  private model: string;
  private defaultMaxTokens: number;
  private defaultTemperature: number;

  constructor(config: AnthropicConfig = { provider: 'anthropic' }) {
    this.client = new Anthropic({
      apiKey: config.apiKey, // Falls back to ANTHROPIC_API_KEY env var
      baseURL: config.baseUrl,
    });
    this.model = config.model || 'claude-sonnet-4-20250514';
    this.defaultMaxTokens = config.defaultMaxTokens || 4096;
    this.defaultTemperature = config.defaultTemperature || 0;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    // Convert messages to Anthropic format
    const messages = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: this.convertContent(m.content),
      }));

    // Get system prompt (from request or first system message)
    const systemPrompt =
      request.systemPrompt ||
      request.messages.find((m) => m.role === 'system')?.content;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: request.maxTokens || this.defaultMaxTokens,
      temperature: request.temperature ?? this.defaultTemperature,
      system: typeof systemPrompt === 'string' ? systemPrompt : undefined,
      messages,
    });

    // Extract text content
    const textContent = response.content.find((c) => c.type === 'text');
    const content = textContent?.type === 'text' ? textContent.text : '';

    return {
      content,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      model: response.model,
      finishReason: response.stop_reason === 'end_turn' ? 'stop' : 'length',
    };
  }

  supportsContentType(type: ContentBlock['type']): boolean {
    return ['text', 'image', 'document'].includes(type);
  }

  getSupportedImageTypes(): string[] {
    return ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  }

  supportsPDF(): boolean {
    return true;
  }

  private convertContent(
    content: string | ContentBlock[]
  ): string | ContentBlockParam[] {
    if (typeof content === 'string') {
      return content;
    }

    return content.map((block): ContentBlockParam => {
      switch (block.type) {
        case 'text':
          return { type: 'text', text: block.text };

        case 'image':
          return {
            type: 'image',
            source: {
              type: 'base64',
              media_type: block.mimeType,
              data: block.data,
            },
          };

        case 'document':
          return {
            type: 'document',
            source: {
              type: 'base64',
              media_type: block.mimeType,
              data: block.data,
            },
          } as ContentBlockParam;

        default:
          throw new Error(`Unsupported content type: ${(block as any).type}`);
      }
    });
  }
}
