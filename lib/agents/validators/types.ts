export interface Violation {
  code: string;
  path: string;
  message: string;
  section?: string;
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; violation: Violation };

export interface ValidatableToolInput {
  name: string;
  description?: string;
  required?: boolean;
}

export interface ValidatableTool {
  name: string;
  description?: string;
  safetyClass?: "read" | "write" | "destructive";
  inputs?: ValidatableToolInput[];
}

export interface ValidatableFacts {
  serverName?: string;
  proposedTools?: ValidatableTool[];
}

export interface ValidatablePlan {
  serverName: string;
  tools: ValidatableTool[];
}
