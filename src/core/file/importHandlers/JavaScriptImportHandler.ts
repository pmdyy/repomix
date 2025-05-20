import fs from 'node:fs/promises';
import path from 'node:path';
import type { LanguageImportHandler } from './LanguageImportHandler.js';

export const jsExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'];

const extractJsImports = (content: string): string[] => {
  const importRegex = /import\s+(?:[^'";]+\s+from\s+)?['"]([^'";]+)['"]/g;
  const requireRegex = /require\(\s*['"]([^'";]+)['"]\s*\)/g;
  const imports = [
    ...Array.from(content.matchAll(importRegex), (m) => m[1]),
    ...Array.from(content.matchAll(requireRegex), (m) => m[1]),
  ];
  return imports.filter((p) => p.startsWith('.'));
};

const resolveJsImportPath: LanguageImportHandler['resolveImportPath'] = async (spec, fromDir, rootDir) => {
  const basePath = path.normalize(path.join(fromDir, spec));
  const ext = path.extname(basePath);
  const baseWithoutExt = ext ? basePath.slice(0, -ext.length) : basePath;

  const candidates: string[] = [];

  // Try the spec as written first
  candidates.push(basePath);

  // Then try resolving by swapping extensions
  for (const e of jsExtensions) {
    candidates.push(baseWithoutExt + e);
  }

  // Also consider index files in the directory
  for (const e of jsExtensions) {
    candidates.push(path.join(baseWithoutExt, `index${e}`));
  }

  for (const candidate of candidates) {
    const filePath = path.join(rootDir, candidate);
    try {
      const stats = await fs.stat(filePath);
      if (stats.isFile()) {
        return path.relative(rootDir, filePath);
      }
    } catch {
      // ignore
    }
  }

  return null;
};

export const JavaScriptImportHandler: LanguageImportHandler = {
  extractImports: extractJsImports,
  resolveImportPath: resolveJsImportPath,
};
