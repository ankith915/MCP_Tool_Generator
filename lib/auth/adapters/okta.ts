import type { AuthAdapter, User } from "../types";

export class OktaAuthAdapter implements AuthAdapter {
  async getCurrentUser(): Promise<User> {
    throw new Error("OktaAuthAdapter: not implemented");
  }
}
