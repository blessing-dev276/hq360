// Models the tracker assistant can run on through the Perplexity Agent API,
// cheapest first. Prices are USD per 1M tokens (input / output), from
// docs.perplexity.ai/docs/agent-api/models as of 2026-10-22.
export const AGENT_MODELS = [
  { id: "openai/gpt-6-luna", label: "GPT-6 Luna", price: "$0.10 / $0.50" },
  { id: "anthropic/claude-haiku-5-5", label: "Claude Haiku 5.5", price: "$0.10 / $0.50" },
  { id: "perplexity/glm-5.3-flash", label: "GLM 5.3 Flash", price: "$0.15 / $0.50" },
  { id: "perplexity/sonar", label: "Perplexity Sonar", price: "$0.25 / $2.50" },
  { id: "google/gemini-3.8-flash", label: "Gemini 3.8 Flash", price: "$0.75 / $3.75" },
  { id: "openai/gpt-6.1-sol", label: "GPT-6.1 Sol", price: "$2 / $10" },
  { id: "anthropic/claude-sonnet-5-5", label: "Claude Sonnet 5.5", price: "$2 / $10" },
  { id: "anthropic/claude-opus-5-5", label: "Claude Opus 5.5", price: "$4 / $20" },
  { id: "anthropic/claude-fable-5-1", label: "Claude Fable 5.1", price: "$10 / $50" },
] as const;
export type AgentModelId = (typeof AGENT_MODELS)[number]["id"];
export const DEFAULT_AGENT_MODEL: AgentModelId = "openai/gpt-6-luna";
export const isAgentModel = (id: string): id is AgentModelId =>
  AGENT_MODELS.some((m) => m.id === id);
