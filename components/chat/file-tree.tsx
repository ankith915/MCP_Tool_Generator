"use client";

import { FileText, FolderClosed, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileBuffer } from "./use-generate-stream";

interface Props {
  files: Record<string, FileBuffer>;
  order: string[];
  activePath: string | null;
  onSelect: (path: string) => void;
}

interface FolderGroup {
  folder: string;
  paths: string[];
}

/**
 * Group paths by their top-level folder for a scannable tree-ish layout.
 * Files at the root land in a leading "(root)" group.
 */
function groupByFolder(order: string[]): FolderGroup[] {
  const groups = new Map<string, string[]>();
  for (const p of order) {
    const slash = p.indexOf("/");
    const folder = slash === -1 ? "" : p.slice(0, slash);
    if (!groups.has(folder)) groups.set(folder, []);
    groups.get(folder)!.push(p);
  }
  // Stable order: root first, then `app/`, then `tests/`, then anything else.
  const priority: Record<string, number> = { "": 0, app: 1, tests: 2 };
  return Array.from(groups.entries())
    .sort((a, b) => (priority[a[0]] ?? 99) - (priority[b[0]] ?? 99))
    .map(([folder, paths]) => ({ folder, paths }));
}

function shortName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function indentDepth(path: string, topFolder: string): number {
  if (topFolder === "") return 0;
  const rest = path.slice(topFolder.length + 1);
  return rest.split("/").length - 1;
}

export function FileTree({ files, order, activePath, onSelect }: Props) {
  const groups = groupByFolder(order);

  if (order.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-3 text-center text-xs text-muted-foreground">
        Files will appear here as they generate.
      </div>
    );
  }

  return (
    <div className="overflow-y-auto py-2 text-sm">
      {groups.map(({ folder, paths }) => (
        <div key={folder} className="mb-2">
          {folder ? (
            <div className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <FolderClosed className="size-3" />
              {folder}/
            </div>
          ) : null}
          {paths.map((path) => {
            const buf = files[path];
            const active = path === activePath;
            const depth = indentDepth(path, folder);
            return (
              <button
                key={path}
                type="button"
                onClick={() => onSelect(path)}
                className={cn(
                  "group flex w-full items-center gap-1.5 px-3 py-1 text-left transition-colors hover:bg-muted/60",
                  active && "bg-muted text-foreground",
                )}
                style={{ paddingLeft: `${0.75 + depth * 0.75}rem` }}
              >
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate font-mono text-[12px]">
                  {shortName(path)}
                </span>
                {buf?.complete ? (
                  <Check className="ml-auto size-3 shrink-0 text-emerald-500" />
                ) : buf ? (
                  <Loader2 className="ml-auto size-3 shrink-0 animate-spin text-muted-foreground" />
                ) : null}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
