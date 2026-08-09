// Keep in sync with Backend/populate_models.py — that seed script is the source
// of truth for the AIModel table the node config panels load dynamically. These
// lists are the static fallback shown before/without that fetch, so they carry a
// trimmed selection per provider: one free option, one cost-efficient option,
// and the current frontier model.
export const LLM_PROVIDERS = [
  { value: 'openrouter', label: 'OpenRouter', description: '100+ models (GPT, Claude, Gemini, …)', icon: '🌐' },
  { value: 'openai', label: 'OpenAI', description: 'GPT-5.6, o-series reasoning', icon: '🤖' },
  { value: 'anthropic', label: 'Anthropic', description: 'Claude Opus/Sonnet/Haiku', icon: '🧠' },
  { value: 'gemini', label: 'Google Gemini', description: 'Gemini 3.x multimodal', icon: '✨' },
  { value: 'deepseek', label: 'DeepSeek', description: 'Low-cost chat & reasoning', icon: '🐋' },
  { value: 'xai', label: 'xAI', description: 'Grok models', icon: '𝕏' },
  { value: 'nvidia', label: 'NVIDIA NIM', description: 'Nemotron + open weights', icon: '⚙️' },
  { value: 'ollama', label: 'Ollama (Local)', description: 'Run locally, free', icon: '🦙' },
  { value: 'perplexity', label: 'Perplexity', description: 'Web search AI', icon: '🔍' },
];

export const MODEL_OPTIONS: Record<string, { value: string; label: string }[]> = {
  openrouter: [
    { value: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'Nemotron 3 Super 120B (Free)' },
    { value: 'openrouter/auto', label: 'Auto Router' },
    { value: 'openrouter/free', label: 'Free Models Router (Free)' },
    { value: 'google/gemma-4-31b-it:free', label: 'Gemma 4 31B (Free)' },
    { value: 'google/gemini-3.6-flash', label: 'Gemini 3.6 Flash (Cheap)' },
    { value: 'openai/gpt-5.6-luna', label: 'GPT-5.6 Luna (Cheap)' },
    { value: 'anthropic/claude-haiku-4.5', label: 'Claude Haiku 4.5 (Cheap)' },
    { value: 'deepseek/deepseek-v4-flash', label: 'DeepSeek V4 Flash (Cheap)' },
    { value: 'openai/gpt-5.6-sol', label: 'GPT-5.6 Sol (Frontier)' },
    { value: 'anthropic/claude-opus-5', label: 'Claude Opus 5 (Frontier)' },
    { value: 'google/gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Frontier)' },
    { value: 'x-ai/grok-4.5', label: 'Grok 4.5 (Frontier)' },
  ],
  openai: [
    { value: 'gpt-5.6-luna', label: 'GPT-5.6 Luna (Cheap)' },
    { value: 'gpt-5.6-terra', label: 'GPT-5.6 Terra (Balanced)' },
    { value: 'gpt-5.6-sol', label: 'GPT-5.6 Sol (Frontier)' },
    { value: 'gpt-5.6-sol-pro', label: 'GPT-5.6 Sol Pro (Frontier)' },
    { value: 'o4-mini', label: 'o4-mini (Reasoning)' },
    { value: 'o3', label: 'o3 (Reasoning)' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Legacy)' },
    { value: 'gpt-4o', label: 'GPT-4o (Legacy)' },
  ],
  anthropic: [
    { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (Cheap)' },
    { value: 'claude-sonnet-5', label: 'Claude Sonnet 5 (Balanced)' },
    { value: 'claude-fable-5', label: 'Claude Fable 5' },
    { value: 'claude-opus-5', label: 'Claude Opus 5 (Frontier)' },
    { value: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet (Legacy)' },
  ],
  gemini: [
    { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite (Cheap)' },
    { value: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash (Balanced)' },
    { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Frontier)' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Legacy)' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Legacy)' },
  ],
  deepseek: [
    { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash (Cheap)' },
    { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro (Frontier)' },
    { value: 'deepseek-chat', label: 'DeepSeek Chat (Stable alias)' },
    { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner (Stable alias)' },
  ],
  xai: [
    { value: 'grok-code-fast-1', label: 'Grok Code Fast 1 (Cheap)' },
    { value: 'grok-4.5', label: 'Grok 4.5 (Frontier)' },
    { value: 'grok-4.20-multi-agent', label: 'Grok 4.20 Multi-Agent (Frontier)' },
  ],
  nvidia: [
    { value: 'nvidia/nemotron-3-nano-30b-a3b', label: 'Nemotron 3 Nano 30B (Cheap)' },
    { value: 'nvidia/nemotron-3-super-120b-a12b', label: 'Nemotron 3 Super 120B (Balanced)' },
    { value: 'nvidia/nemotron-3-ultra-550b-a55b', label: 'Nemotron 3 Ultra 550B (Frontier)' },
    { value: 'deepseek-ai/deepseek-v4-flash', label: 'DeepSeek V4 Flash (Cheap)' },
    { value: 'deepseek-ai/deepseek-v4-pro', label: 'DeepSeek V4 Pro (Frontier)' },
    { value: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B (Open weights)' },
    { value: 'meta/llama-3.3-70b-instruct', label: 'Llama 3.3 70B Instruct' },
  ],
  ollama: [
    // All local models are free — these are suggestions, the real list is
    // whatever tags the user has pulled.
    { value: 'gemma4:4b', label: 'Gemma 4 (4B)' },
    { value: 'qwen3:8b', label: 'Qwen 3 (8B)' },
    { value: 'deepseek-r1:8b', label: 'DeepSeek R1 (8B)' },
    { value: 'phi4:latest', label: 'Phi 4' },
    { value: 'mistral:7b', label: 'Mistral (7B)' },
    { value: 'qwen2.5-coder:32b', label: 'Qwen 2.5 Coder (32B)' },
    { value: 'qwen3.6:latest', label: 'Qwen 3.6' },
    { value: 'llama4:scout', label: 'Llama 4 Scout' },
  ],
  perplexity: [
    { value: 'sonar', label: 'Sonar (Cheap)' },
    { value: 'sonar-pro', label: 'Sonar Pro' },
    { value: 'sonar-reasoning', label: 'Sonar Reasoning' },
    { value: 'sonar-reasoning-pro', label: 'Sonar Reasoning Pro' },
    { value: 'sonar-deep-research', label: 'Sonar Deep Research' },
  ],
};
