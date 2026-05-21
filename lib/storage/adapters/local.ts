import fs from "node:fs/promises";
import path from "node:path";
import type { StorageAdapter } from "../types";

export class LocalAdapter implements StorageAdapter {
  constructor(
    private readonly dir = path.join(process.cwd(), ".artifacts"),
  ) {}

  async put(key: string, data: Buffer): Promise<void> {
    const dest = path.join(this.dir, key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, data);
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(path.join(this.dir, key));
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await fs.unlink(path.join(this.dir, key)).catch(() => {});
  }

  url(key: string): string {
    return `/api/artifacts/${key}`;
  }
}
