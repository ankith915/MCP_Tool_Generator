import type { AuthAdapter, User } from "../types";

const DEV_USER: User = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "dev@localhost",
  name: "Dev User",
  workspaceId: "00000000-0000-0000-0000-000000000001",
};

export class NoopAuthAdapter implements AuthAdapter {
  async getCurrentUser(): Promise<User> {
    return DEV_USER;
  }
}
