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
  for (const ext of [''].concat(jsExtensions)) {
    const filePath = path.join(rootDir, basePath + ext);
    try {
      const stats = await fs.stat(filePath);
      if (stats.isFile()) {
        return path.relative(rootDir, filePath);
      }
    } catch {
      // ignore
    }
  }
  for (const ext of jsExtensions) {
    const indexPath = path.join(rootDir, basePath, `index${ext}`);
    try {
      const stats = await fs.stat(indexPath);
      if (stats.isFile()) {
        return path.relative(rootDir, indexPath);
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
