import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { createVertex } from '@ai-sdk/google-vertex';
import { LanguageModel } from 'ai';

export type LLMProvider = 'openai' | 'gemini' | 'claude' | 'groq' | 'bedrock-mantle' | 'ollama' | 'amazon-bedrock' | 'google-vertex';

export type ModelConfig = {
  provider: LLMProvider;
  modelId: string;
  apiKey?: string;
  ollamaBaseUrl?: string;
  bedrockRegion?: string;
  awsSecretKey?: string;
};

export const PROVIDER_MODELS: Record<LLMProvider, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini'],
  gemini: ['gemini-3.8-flash', 'gemini-3.1-flash-preview', 'gemini-3.1-pro-preview'],
  'google-vertex': [
    'gemini-3.8-flash',
    'gemini-3.8-flash',
    'gemini-3.1-pro-preview',
    'gemini-3.8-flash',
  ],
  claude: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
  'bedrock-mantle': [
    'openai.gpt-oss-120b',
    'anthropic.claude-haiku-4-5',
    'anthropic.claude-sonnet-4-5',
    'anthropic.claude-3-5-haiku-20241022-v1:0',
    'google.gemma-4-26b-a4b',
    'meta.llama3-1-70b-instruct-v1:0',
  ],
  'amazon-bedrock': [
    'anthropic.claude-3-5-sonnet-20241022-v2:0',
    'anthropic.claude-3-5-haiku-20241022-v1:0',
    'amazon.nova-pro-v1:0',
    'amazon.nova-lite-v1:0',
    'meta.llama3-1-70b-instruct-v1:0',
  ],
  ollama: ['llama3.2', 'mistral', 'qwen2.5', 'deepseek-r1'],
};

export function resolveLanguageModel(config: ModelConfig): LanguageModel {
  let { provider, modelId, apiKey, ollamaBaseUrl, bedrockRegion } = config;

  // Auto-upgrade deprecated or invalid Gemini model IDs
  if (['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash', 'gemini-2.5-flash'].includes(modelId)) {
    modelId = 'gemini-3.8-flash';
  }

  switch (provider) {
    case 'openai': {
      const openai = createOpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY });
      return openai(modelId);
    }
    case 'gemini': {
      const google = createGoogleGenerativeAI({ apiKey: apiKey || process.env.GEMINI_API_KEY });
      return google(modelId);
    }
    case 'claude': {
      const anthropic = createAnthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY });
      return anthropic(modelId);
    }
    case 'groq': {
      const groq = createOpenAI({
        apiKey: apiKey || process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
      });
      return groq(modelId);
    }
    case 'bedrock-mantle': {
      const region = bedrockRegion || process.env.BEDROCK_MANTLE_REGION || 'us-east-1';
      const bedrockApiKey = apiKey || process.env.BEDROCK_MANTLE_API_KEY || '';
      const mantleBase = `https://bedrock-mantle.${region}.api.aws`;

      if (modelId.startsWith('anthropic.')) {
        // Anthropic models → /anthropic base path → Anthropic Messages API wire format
        const anthropic = createAnthropic({
          apiKey: bedrockApiKey,
          baseURL: `${mantleBase}/anthropic`,
          headers: { 'x-api-key': bedrockApiKey },
        });
        return anthropic(modelId);
      }

      // All other models (openai.*, google.*, meta.*, zai.*, etc.) →
      // /v1/chat/completions (classic OpenAI Chat Completions format).
      // The SDK v2 may try to call /v1/responses; we force it back to
      // /chat/completions by rewriting the URL in the fetch interceptor.
      const bedrock = createOpenAI({
        apiKey: 'unused',
        baseURL: `${mantleBase}/v1`,
        headers: {
          'x-api-key': bedrockApiKey,
          'OpenAI-Project': 'default',
        },
        fetch: async (url: any, options?: any) => {
          const headers = new Headers(options?.headers);
          // Strip auto-injected Authorization header — Bedrock uses x-api-key only
          headers.delete('authorization');
          headers.delete('Authorization');

          let urlStr = url.toString();
          let body = options?.body;

          // SDK v2 may call /v1/responses with a Responses API body ({ input, model })
          // instead of Chat Completions ({ messages, model }).
          // We rewrite both the URL and the body to the Chat Completions format.
          if (urlStr.includes('/v1/responses')) {
            urlStr = urlStr.replace('/v1/responses', '/v1/chat/completions');

            if (body && typeof body === 'string') {
              try {
                const parsed = JSON.parse(body);
                if (parsed.input !== undefined && !parsed.messages) {
                  // Transform Responses API → Chat Completions
                  // Responses API: content = [{ type: "input_text", text: "..." }]
                  // Chat Completions: content = "plain string"
                  const normalizeContent = (content: unknown): string => {
                    if (typeof content === 'string') return content;
                    if (Array.isArray(content)) {
                      return content
                        .map((c: any) => c.text ?? c.content ?? '')
                        .join('');
                    }
                    return String(content ?? '');
                  };

                  const messages = Array.isArray(parsed.input)
                    ? parsed.input.map((msg: any) => ({
                        role: msg.role ?? 'user',
                        content: normalizeContent(msg.content),
                      }))
                    : [{ role: 'user', content: String(parsed.input) }];

                  const transformed: Record<string, unknown> = { model: parsed.model, messages };
                  if (parsed.max_output_tokens) transformed.max_tokens = parsed.max_output_tokens;
                  if (parsed.temperature !== undefined) transformed.temperature = parsed.temperature;
                  if (parsed.top_p !== undefined) transformed.top_p = parsed.top_p;

                  body = JSON.stringify(transformed);
                }
              } catch {
                // If parsing fails, pass through as-is
              }
            }
          }

          const res = await fetch(urlStr, { ...options, headers, body });

          // AI SDK v2 always parses responses in Responses API format:
          // { output: [{ type:'message', content:[{ type:'output_text', text:'...' }] }], usage: { input_tokens, output_tokens } }
          // But Bedrock returns Chat Completions format:
          // { choices: [{ message: { content: '...' } }], usage: { prompt_tokens, completion_tokens } }
          // We transform the Chat Completions response into the Responses API shape the SDK expects.
          try {
            const cc = await res.json();

            // If already in Responses API format (has output field), pass through
            if (cc.output) {
              return new Response(JSON.stringify(cc), { status: res.status, headers: res.headers });
            }

            const choice = cc.choices?.[0];
            const text = choice?.message?.content ?? '';
            const finishReason = choice?.finish_reason ?? 'stop';

            const responsesBody = {
              id: cc.id ?? `resp_${Date.now()}`,
              object: 'response',
              created_at: cc.created ?? Math.floor(Date.now() / 1000),
              model: cc.model,
              status: 'completed',
              stop_reason: finishReason === 'stop' ? 'end_turn' : finishReason,
              output: [
                {
                  type: 'message',
                  id: `msg_${Date.now()}`,
                  role: 'assistant',
                  status: 'completed',
                  content: [{ type: 'output_text', text, annotations: [] }],
                },
              ],
              usage: {
                input_tokens: cc.usage?.prompt_tokens ?? cc.usage?.input_tokens ?? 0,
                output_tokens: cc.usage?.completion_tokens ?? cc.usage?.output_tokens ?? 0,
                total_tokens: cc.usage?.total_tokens ?? 0,
              },
            };

            return new Response(JSON.stringify(responsesBody), {
              status: res.status,
              statusText: res.statusText,
              headers: res.headers,
            });
          } catch {
            return res;
          }
        },
      });
      return bedrock(modelId);
    }
    case 'ollama': {
      const ollamaUrl = ollamaBaseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      const ollama = createOpenAI({
        baseURL: `${ollamaUrl}/v1`,
        apiKey: 'ollama', // API key is required but ignored by Ollama
      });
      return ollama(modelId);
    }
    case 'amazon-bedrock': {
      const region = bedrockRegion || process.env.AWS_REGION || 'us-east-1';
      // For Amazon Bedrock we use apiKey for accessKeyId and the new awsSecretKey field
      const accessKeyId = apiKey || process.env.AWS_ACCESS_KEY_ID || '';
      const secretAccessKey = config.awsSecretKey || process.env.AWS_SECRET_ACCESS_KEY || '';
      
      const bedrock = createAmazonBedrock({
        region,
        accessKeyId,
        secretAccessKey,
      });
      return bedrock(modelId);
    }
    case 'google-vertex': {
      const vertexApiKey = apiKey || process.env.GOOGLE_VERTEX_API_KEY;
      const project = process.env.GOOGLE_VERTEX_PROJECT_ID;
      const location = bedrockRegion || process.env.GOOGLE_VERTEX_REGION || 'us-central1';

      const vertex = createVertex({
        apiKey: vertexApiKey,
        project,
        location,
      });
      return vertex(modelId);
    }
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

