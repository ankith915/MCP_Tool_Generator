import { Eta } from "eta";
import path from "node:path";

const TEMPLATES_ROOT = path.join(process.cwd(), "templates");

const eta = new Eta({
  views: TEMPLATES_ROOT,
  autoEscape: false,
  cache: process.env["NODE_ENV"] === "production",
});

/**
 * Renders a single eta template file to a string.
 *
 * @param templatePath - Path relative to the templates/ directory, without the .eta extension.
 *   Example: "typescript/streamable-http/src/index.ts"
 * @param data - Template data object available as `it` inside the template.
 */
export async function renderTemplate(
  templatePath: string,
  data: Record<string, unknown>,
): Promise<string> {
  const result = await eta.renderAsync(templatePath, data);
  if (result === undefined) {
    throw new Error(`Template rendered to undefined: ${templatePath}`);
  }
  return result;
}

/**
 * Renders a set of template files and returns a map of output filename → content.
 *
 * @param templateDir - Sub-directory under templates/, e.g. "typescript/streamable-http"
 * @param templateMap - Array of { tpl, out } pairs mapping template names to output filenames
 * @param data - Template data object
 */
export async function renderAll(
  templateDir: string,
  templateMap: Array<{ tpl: string; out: string }>,
  data: Record<string, unknown>,
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  await Promise.all(
    templateMap.map(async ({ tpl, out }) => {
      results[out] = await renderTemplate(`${templateDir}/${tpl}`, data);
    }),
  );
  return results;
}
