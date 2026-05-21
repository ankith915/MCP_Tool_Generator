# ADR 0003 — JSZip instead of Archiver for ZIP generation

Date: 2026-05-21
Status: Accepted

## Context

The generator service (`server/services/generate.ts`) needs to pack rendered
template files into a ZIP buffer that is then written to `StorageAdapter` and
served as a browser download. The original plan nominated `archiver` (v8.0.0),
a well-known Node.js streaming archive library (MIT, ~5M weekly downloads).

During Phase 1c development, `archiver` was added as a dependency and the
generate service imported it with `import archiver from "archiver"`. This
broke the dev server immediately with:

```
Export default doesn't exist in target module
The export default was not found in module archiver/index.js [app-rsc] (ecmascript).
Did you mean to import TarArchive?
```

**Root cause:** `archiver` v8 changed its exports to use the CommonJS
`module.exports = archiver` (`export =`) pattern rather than a named or
default ESM export. Next.js 16 with Turbopack performs static ESM analysis
at build time. When it encounters `export =`, it cannot resolve a `default`
export and fails the build — even though Node.js itself handles `export =`
interop at runtime via `esModuleInterop`. The failure is at bundler analysis
time, not at runtime.

Alternatives considered:

| Option | Notes |
|---|---|
| `import * as archiver from "archiver"` | Still fails; Turbopack's static analysis doesn't produce a callable default |
| `createRequire(import.meta.url)` | Works at runtime but adds CJS interop boilerplate and is fragile across Turbopack versions |
| Switch to a dynamically imported CJS wrapper | Possible but adds indirection and defeats tree-shaking |
| `jszip` | Pure ESM, browser + Node compatible, MIT, ~10M weekly downloads |
| `adm-zip` | Node-only, MIT, ~5M weekly downloads; no streaming, but fine for in-memory |

## Decision

Replace `archiver` with `jszip` (v3.10.1).

The JSZip API for our use case is simpler than the streaming archiver API:

```typescript
// Before (archiver — never worked in this project)
const archive = archiver("zip", { zlib: { level: 9 } });
archive.pipe(passThrough);
for (const [name, content] of Object.entries(files)) archive.append(content, { name });
await archive.finalize();

// After (jszip — 4 lines, no stream management)
const zip = new JSZip();
for (const [name, content] of Object.entries(files)) zip.file(name, content);
return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
```

## Consequences

- **Positive:** No CJS interop issues. Works in Turbopack, Edge Functions,
  and any Web Standard environment without modification.
- **Positive:** The API is cleaner for our use case (in-memory file map →
  Buffer), with no stream lifecycle to manage.
- **Neutral:** JSZip does not support streaming output. For the POC, ZIP
  files are small (< 50KB), so buffering in memory is fine. If very large
  artifacts ever need streaming, revisit — but that would be a Phase 5+
  concern.
- **If swapping back to archiver:** The key constraint is that the import must
  be a dynamic `import()` inside the function body, not a top-level ESM
  import, to avoid Turbopack's static analysis. The streaming API would also
  require a `PassThrough` stream and a `Buffer.concat` collector.
