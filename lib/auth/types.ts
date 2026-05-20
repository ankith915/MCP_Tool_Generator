export interface User {
  id: string;
  email: string;
  name: string;
  workspaceId: string;
}

export interface AuthAdapter {
  getCurrentUser(request?: Request): Promise<User>;
}
