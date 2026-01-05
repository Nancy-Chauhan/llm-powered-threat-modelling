import type { LLMProvider, ProviderConfig, ProviderType } from './types';
import { AnthropicProvider } from './providers/anthropic';
import { OpenAIProvider } from './providers/openai';

/**
 * LLM Provider Factory
 *
 * Creates LLM provider instances based on configuration.
 * Supports environment-based configuration for easy switching.
 */

// Default provider from environment
const DEFAULT_PROVIDER = (process.env.LLM_PROVIDER as ProviderType) || 'openai';

// Provider registry
const providers = new Map<string, LLMProvider>();

/**
 * Create a new provider instance
 */
export function createProvider(config: ProviderConfig): LLMProvider {
  switch (config.provider) {
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'openai':
      return new OpenAIProvider(config);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

/**
 * Get the default provider (singleton based on env config)
 */
export function getDefaultProvider(): LLMProvider {
  const key = `default-${DEFAULT_PROVIDER}`;

  if (!providers.has(key)) {
    const config = getConfigFromEnv();
    providers.set(key, createProvider(config));
  }

  return providers.get(key)!;
}

/**
 * Get or create a named provider instance
 */
export function getProvider(name: string, config?: ProviderConfig): LLMProvider {
  if (!providers.has(name)) {
    if (!config) {
      throw new Error(`Provider "${name}" not found and no config provided`);
    }
    providers.set(name, createProvider(config));
  }

  return providers.get(name)!;
}

/**
 * Register a custom provider instance
 */
export function registerProvider(name: string, provider: LLMProvider): void {
  providers.set(name, provider);
}

/**
 * Build config from environment variables
 */
function getConfigFromEnv(): ProviderConfig {
  const provider = DEFAULT_PROVIDER;

  switch (provider) {
    case 'anthropic':
      return {
        provider: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
        defaultMaxTokens: parseInt(process.env.LLM_MAX_TOKENS || '4096'),
        defaultTemperature: parseFloat(process.env.LLM_TEMPERATURE || '0'),
      };

    case 'openai':
      return {
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        baseUrl: process.env.OPENAI_BASE_URL,
        defaultMaxTokens: parseInt(process.env.LLM_MAX_TOKENS || '4096'),
        defaultTemperature: parseFloat(process.env.LLM_TEMPERATURE || '0'),
      };

    default:
      throw new Error(`Unknown provider in environment: ${provider}`);
  }
}

/**
 * Get all registered provider names
 */
export function getRegisteredProviders(): string[] {
  return Array.from(providers.keys());
}

/**
 * Clear all cached providers (useful for testing)
 */
export function clearProviders(): void {
  providers.clear();
}
