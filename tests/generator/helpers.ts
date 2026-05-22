import { expect } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { renderProject } from "@/server/services/generate";
import type { WizardConfig } from "@/lib/schemas/wizard";

export interface BootCheckSpec {
  startCmd: string[];
  probeUrl: string;
  expectedStatuses: number[];
  startupMs: number;
}

export interface ToolchainSpec {
  installCmd: string[];
  testCmd: string[];
  buildCmd?: string[];
  bootCheck?: BootCheckSpec;
}

export interface GeneratorTestCase {
  name: string;
  config: WizardConfig;
  expectedFiles: string[];
  contentAssertions?: Array<{ file: string; contains: string }>;
  toolchain: ToolchainSpec;
}

/**
 * Runs a subprocess using child_process.spawn, capturing stdout/stderr.
 * Resolves with the exit code. Rejects with a descriptive error (including
 * captured output) if the process exits non-zero.
 */
function runCmd(
  args: string[],
  cwd: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const [cmd, ...rest] = args;
    if (!cmd) {
      reject(new Error("runCmd: empty command"));
      return;
    }

    const chunks: Buffer[] = [];
    const child = spawn(cmd, rest, {
      cwd,
      env: process.env,
      shell: false,
    });

    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => chunks.push(chunk));

    child.on("error", (err) => {
      reject(new Error(`Failed to spawn ${args.join(" ")}: ${err.message}`));
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        const output = Buffer.concat(chunks).toString("utf-8");
        reject(
          new Error(
            `Command exited with code ${code}: ${args.join(" ")}\n\n--- stdout/stderr ---\n${output}`,
          ),
        );
      }
    });
  });
}

/**
 * Polls a URL every 500 ms until the response status is one of expectedStatuses
 * or until startupMs elapses. Returns the final response status or throws on timeout.
 */
async function pollUrl(
  probeUrl: string,
  expectedStatuses: number[],
  startupMs: number,
): Promise<number> {
  const deadline = Date.now() + startupMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(probeUrl);
      if (expectedStatuses.includes(res.status)) {
        return res.status;
      }
    } catch {
      // server not yet ready — keep polling
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(
    `Server at ${probeUrl} did not respond with status in [${expectedStatuses.join(", ")}] within ${startupMs} ms`,
  );
}

export async function runGeneratorTest(testCase: GeneratorTestCase): Promise<void> {
  // 1. Render all template files
  const files = await renderProject(testCase.config);

  // 2. Write to a temp directory
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), "mcp-gen-"));
  try {
    for (const [filename, content] of Object.entries(files)) {
      const fullPath = path.join(tmpDir, filename);
      mkdirSync(path.dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, content, "utf-8");
    }

    // 3. Assert all expected files are present in the rendered output
    for (const expectedFile of testCase.expectedFiles) {
      expect(files).toHaveProperty(expectedFile);
    }

    // 4. Content assertions
    if (testCase.contentAssertions) {
      for (const { file, contains } of testCase.contentAssertions) {
        const content = files[file] ?? "";
        expect(
          content,
          `Expected "${file}" to contain: ${contains}`,
        ).toContain(contains);
      }
    }

    // 5. Install
    await runCmd(testCase.toolchain.installCmd, tmpDir);

    // 6. Test
    await runCmd(testCase.toolchain.testCmd, tmpDir);

    // 7. Build (optional)
    if (testCase.toolchain.buildCmd) {
      await runCmd(testCase.toolchain.buildCmd, tmpDir);
    }

    // 8. Boot check (optional)
    if (testCase.toolchain.bootCheck) {
      const { startCmd, probeUrl, expectedStatuses, startupMs } =
        testCase.toolchain.bootCheck;

      const [cmd, ...rest] = startCmd;
      if (!cmd) throw new Error("bootCheck.startCmd is empty");

      const serverProcess = spawn(cmd, rest, {
        cwd: tmpDir,
        env: process.env,
        shell: false,
        detached: false,
      });

      try {
        const status = await pollUrl(probeUrl, expectedStatuses, startupMs);
        expect(expectedStatuses).toContain(status);
      } finally {
        serverProcess.kill("SIGTERM");
      }
    }
  } finally {
    // 9. Clean up
    rmSync(tmpDir, { recursive: true, force: true });
  }
}
