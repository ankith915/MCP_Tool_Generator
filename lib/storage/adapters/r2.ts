import type { StorageAdapter } from "../types";

export class R2Adapter implements StorageAdapter {
  async put(): Promise<void> {
    throw new Error("R2Adapter: not implemented");
  }
  async get(): Promise<Buffer | null> {
    throw new Error("R2Adapter: not implemented");
  }
  async delete(): Promise<void> {
    throw new Error("R2Adapter: not implemented");
  }
  url(): string {
    throw new Error("R2Adapter: not implemented");
  }
}
