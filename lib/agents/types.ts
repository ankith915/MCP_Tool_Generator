export type AgentRole = "user" | "clarification" | "plan" | "system";

export interface AgentMessage {
  role: AgentRole;
  content: string;
  structured?: unknown;
}

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
