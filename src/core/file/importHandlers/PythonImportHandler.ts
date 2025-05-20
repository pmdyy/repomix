import fs from 'node:fs/promises';
import path from 'node:path';
import type { LanguageImportHandler } from './LanguageImportHandler.js';

const extractPyImports = (content: string): string[] => {
  const result: string[] = [];
  const fromRegex = /from\s+([.\w]+)\s+import\s+([^\n]+)/g;
  const importRegex = /^\s*import\s+([^\n]+)/gm;

  for (const m of content.matchAll(fromRegex)) {
    const base = m[1];
    const names = m[2]
      .split(',')
      .map((n) => n.trim().split(/\s+/)[0])
      .filter(Boolean);
    if (base.startsWith('.')) {
      for (const name of names) {
        result.push(`${base}.${name}`);
      }
    } else {
      result.push(base);
    }
  }

  for (const m of content.matchAll(importRegex)) {
    const specs = m[1]
      .split(',')
      .map((s) => s.trim().split(/\s+/)[0])
      .filter(Boolean);
    for (const spec of specs) {
      result.push(spec);
    }
  }

  return result;
};

const resolvePyImportPath: LanguageImportHandler['resolveImportPath'] = async (spec, fromDir, rootDir) => {
  const isRelative = spec.startsWith('.');
  const specPath = spec.replace(/^\.+/, (dots) => '../'.repeat(dots.length - 1)).replace(/\./g, '/');

  const normalizedFromDir = fromDir === '.' ? '' : fromDir;
  const searchDirs: string[] = [];

  if (isRelative) {
    searchDirs.push(normalizedFromDir);
  } else {
    let dir = normalizedFromDir;
    while (true) {
      searchDirs.push(dir === '.' ? '' : dir);
      if (dir === '' || dir === '.') break;
      dir = path.dirname(dir);
    }
  }

  for (const dir of searchDirs) {
    const basePath = path.normalize(path.join(dir, specPath));
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
  }

  return null;
};

export const PythonImportHandler: LanguageImportHandler = {
  extractImports: extractPyImports,
  resolveImportPath: resolvePyImportPath,
};
