import fs from 'node:fs/promises';
import path from 'node:path';
import type { LanguageImportHandler } from './LanguageImportHandler.js';

const extractPyImports = async (content: string): Promise<string[]> => {
  const result: string[] = [];
  const fromRegex = /from\s+([.\w]+)\s+import\s+([\w*, ]+)/g;
  const importRegex = /import\s+([.\w]+)/g;

  for (const m of content.matchAll(fromRegex)) {
    const base = m[1];
    const names = m[2].split(/[,\s]+/).filter(Boolean);
    for (const name of names) {
      if (base.startsWith('.')) {
        result.push(`${base}.${name}`);
      }
    }
  }
  for (const m of content.matchAll(importRegex)) {
    const spec = m[1];
    if (spec.startsWith('.')) {
      result.push(spec);
    }
  }
  return result;
};

const resolvePyImportPath: LanguageImportHandler['resolveImportPath'] = async (spec, fromDir, rootDir) => {
  const rel = spec.replace(/^\.+/, (dots) => '../'.repeat(dots.length - 1)).replace(/\./g, '/');
  const basePath = path.normalize(path.join(fromDir, rel));
  const candidates = [path.join(rootDir, `${basePath}.py`), path.join(rootDir, basePath, '__init__.py')];
  for (const filePath of candidates) {
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

export const PythonImportHandler: LanguageImportHandler = {
  extractImports: extractPyImports,
  resolveImportPath: resolvePyImportPath,
};
