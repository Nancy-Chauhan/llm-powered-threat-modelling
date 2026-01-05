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
 * Files are fetched from URLs and sent to the API.
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
    // Convert messages to Anthropic format (async to fetch URLs)
    const messages = await Promise.all(
      request.messages
        .filter((m) => m.role !== 'system')
        .map(async (m) => ({
          role: m.role as 'user' | 'assistant',
          content: await this.convertContent(m.content),
        }))
    );

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

  private async convertContent(
    content: string | ContentBlock[]
  ): Promise<string | ContentBlockParam[]> {
    if (typeof content === 'string') {
      return content;
    }

    const results: ContentBlockParam[] = [];

    for (const block of content) {
      switch (block.type) {
        case 'text':
          results.push({ type: 'text', text: block.text });
          break;

        case 'image': {
          // Fetch image from URL and convert to base64
          const imageData = await this.fetchAsBase64(block.url);
          results.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: block.mimeType,
              data: imageData,
            },
          });
          break;
        }

        case 'document': {
          // Fetch document from URL and convert to base64
          const docData = await this.fetchAsBase64(block.url);
          results.push({
            type: 'document',
            source: {
              type: 'base64',
              media_type: block.mimeType,
              data: docData,
            },
          } as ContentBlockParam);
          break;
        }

        default:
          throw new Error(`Unsupported content type: ${(block as ContentBlock).type}`);
      }
    }

    return results;
  }

  private async fetchAsBase64(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch file from ${url}: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
  }
}
