# TradeMall Multi-Provider AI

TradeMall's AI Copilot uses a provider-agnostic server-side gateway. It supports Gemini, OpenAI, Anthropic/Claude, Mistral, DeepSeek, xAI/Grok and Ollama without adding provider SDK dependencies.

## Configuration

Set the provider order with:

`AI_PROVIDER_ORDER=gemini,grok,openai,claude,mistral,deepseek,ollama`

Only configured providers are used. Cloud providers require their server-side API key. Ollama requires `OLLAMA_BASE_URL` and a compatible model.

Available settings:

- `GEMINI_API_KEY`, `GEMINI_MODEL`
- `OPENAI_API_KEY`, `OPENAI_MODEL`
- `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`
- `MISTRAL_API_KEY`, `MISTRAL_MODEL`
- `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`
- `XAI_API_KEY`, `XAI_MODEL`
- `OLLAMA_BASE_URL`, `OLLAMA_MODEL`

All secrets are server-side only. Never prefix them with `VITE_`.

## Fallback behavior

For each AI operation, TradeMall tries providers in `AI_PROVIDER_ORDER`. If a configured provider times out, is rate-limited, is unavailable, or returns an invalid response, the gateway moves to the next configured provider. It does not expose provider credentials to the browser.

The application validates the final structured response with Zod and validates TradeMall-owned IDs and financial values before using them.

## Ollama

Ollama can run on a developer workstation, a private server, or a VPS reachable by the TradeMall server. A production deployment cannot use `127.0.0.1` to reach Ollama running on a different machine. Set `OLLAMA_BASE_URL` to a reachable private endpoint and use a model that supports the requested task. Vision/image analysis requires a vision-capable Ollama model.

## Cost control

Provider order is a routing policy, not a guarantee of unlimited usage. Free tiers and provider quotas still apply. Keep rate limits enabled, use smaller local models for simple tasks, and choose task-appropriate models. TradeMall records the selected provider/model in AI audit metadata so usage and fallback behavior can be investigated.
