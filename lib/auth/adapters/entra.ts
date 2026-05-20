import type { AuthAdapter, User } from "../types";

export class EntraAuthAdapter implements AuthAdapter {
  async getCurrentUser(): Promise<User> {
    throw new Error("EntraAuthAdapter: not implemented");
  }
}
