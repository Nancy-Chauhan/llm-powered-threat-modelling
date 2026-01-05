import OpenAI from 'openai';
import type {
  LLMProvider,
  LLMRequest,
  LLMResponse,
  ContentBlock,
  OpenAIConfig,
} from '../types';
import type {
  ChatCompletionMessageParam,
  ChatCompletionContentPart,
} from 'openai/resources/chat/completions';

/**
 * OpenAI Provider
 *
 * Supports: text, images (JPEG, PNG, GIF, WebP)
 * Note: OpenAI doesn't support PDF natively - text must be extracted first
 * Files are provided via URL - OpenAI fetches them directly.
 */
export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  private client: OpenAI;
  private model: string;
  private defaultMaxTokens: number;
  private defaultTemperature: number;

  constructor(config: OpenAIConfig = { provider: 'openai' }) {
    this.client = new OpenAI({
      apiKey: config.apiKey, // Falls back to OPENAI_API_KEY env var
      baseURL: config.baseUrl,
    });
    this.model = config.model || 'gpt-4o';
    this.defaultMaxTokens = config.defaultMaxTokens || 4096;
    this.defaultTemperature = config.defaultTemperature || 0;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    // Convert messages to OpenAI format
    const messages: ChatCompletionMessageParam[] = [];

    // Add system prompt
    const systemPrompt =
      request.systemPrompt ||
      request.messages.find((m) => m.role === 'system')?.content;

    if (systemPrompt && typeof systemPrompt === 'string') {
      messages.push({ role: 'system', content: systemPrompt });
    }

    // Add other messages
    for (const msg of request.messages) {
      if (msg.role === 'system') continue;

      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: this.convertContent(msg.content),
      });
    }

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: request.maxTokens || this.defaultMaxTokens,
      temperature: request.temperature ?? this.defaultTemperature,
      messages,
      response_format:
        request.responseFormat === 'json' ? { type: 'json_object' } : undefined,
    });

    const choice = response.choices[0];
    const content = choice?.message?.content || '';

    return {
      content,
      usage: response.usage
        ? {
            inputTokens: response.usage.prompt_tokens,
            outputTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
      model: response.model,
      finishReason: choice?.finish_reason === 'stop' ? 'stop' : 'length',
    };
  }

  supportsContentType(type: ContentBlock['type']): boolean {
    // OpenAI supports text and images, but NOT PDFs natively
    return ['text', 'image'].includes(type);
  }

  getSupportedImageTypes(): string[] {
    return ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  }

  supportsPDF(): boolean {
    // OpenAI doesn't support PDF - we need to extract text
    return false;
  }

  private convertContent(
    content: string | ContentBlock[]
  ): string | ChatCompletionContentPart[] {
    if (typeof content === 'string') {
      return content;
    }

    return content
      .map((block): ChatCompletionContentPart | null => {
        switch (block.type) {
          case 'text':
            return { type: 'text', text: block.text };

          case 'image':
            // Pass URL directly - OpenAI fetches images from URLs
            return {
              type: 'image_url',
              image_url: {
                url: block.url,
                detail: 'high',
              },
            };

          case 'document':
            // OpenAI doesn't support PDFs - skip or convert to text
            console.warn(
              'OpenAI does not support PDF documents. PDF content will be skipped.'
            );
            return null;

          default:
            throw new Error(`Unsupported content type: ${(block as ContentBlock).type}`);
        }
      })
      .filter((block): block is ChatCompletionContentPart => block !== null);
  }
}
