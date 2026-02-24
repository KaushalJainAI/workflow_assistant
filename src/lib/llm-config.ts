export const LLM_PROVIDERS = [
  { value: 'openrouter', label: 'OpenRouter', description: '100+ models (GPT-4, Claude, etc.)', icon: '🌐' },
  { value: 'openai', label: 'OpenAI', description: 'GPT-4o, GPT-4', icon: '🤖' },
  { value: 'gemini', label: 'Google Gemini', description: 'Gemini 2.0, 1.5', icon: '✨' },
  { value: 'ollama', label: 'Ollama (Local)', description: 'Run locally', icon: '🦙' },
  { value: 'perplexity', label: 'Perplexity', description: 'Web search AI', icon: '🔍' },
];

export const MODEL_OPTIONS: Record<string, { value: string; label: string }[]> = {
  openrouter: [
    { value: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash (Free)' },
    { value: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (Free)' },
    { value: 'openai/gpt-4o', label: 'GPT-4o' },
    { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
    { value: 'deepseek/deepseek-r1', label: 'DeepSeek R1' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ],
  gemini: [
    { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-2.0-flash-lite-preview-02-05', label: 'Gemini 2.0 Flash Lite' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  ],
  ollama: [
    { value: 'gemma3:4b', label: 'Gemma 3 (4B)' },
    { value: 'qwen3:4b', label: 'Qwen 3 (4B)' },
    { value: 'llama3.2', label: 'Llama 3.2' },
    { value: 'llama3.1', label: 'Llama 3.1' },
    { value: 'mistral', label: 'Mistral' },
    { value: 'codellama', label: 'Code Llama' },
    { value: 'phi3', label: 'Phi-3' },
    { value: 'gemma2', label: 'Gemma 2' },
  ],
  perplexity: [
    { value: 'sonar', label: 'Sonar' },
    { value: 'sonar-pro', label: 'Sonar Pro' },
    { value: 'sonar-reasoning', label: 'Sonar Reasoning' },
  ],
};
