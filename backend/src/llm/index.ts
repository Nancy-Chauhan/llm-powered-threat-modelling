// LLM Provider Abstraction Layer
//
// Usage:
//   import { getDefaultProvider } from './llm';
//   const provider = getDefaultProvider();
//   const response = await provider.complete({ messages: [...] });
//
// Or with specific config:
//   import { createProvider } from './llm';
//   const provider = createProvider({ provider: 'openai', model: 'gpt-4o' });

export * from './types';
export * from './factory';
export { AnthropicProvider } from './providers/anthropic';
export { OpenAIProvider } from './providers/openai';
