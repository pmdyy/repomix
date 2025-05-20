import fs from 'node:fs/promises';
import path from 'node:path';
import type { LanguageImportHandler } from './LanguageImportHandler.js';

const extractRustImports = (content: string): string[] => {
  const modRegex = /mod\s+([A-Za-z0-9_]+)/g;
  const useRegex = /use\s+(?:crate|self|super)::([A-Za-z0-9_:]+)/g;
  const imports = [
    ...Array.from(content.matchAll(modRegex), (m) => m[1]),
    ...Array.from(content.matchAll(useRegex), (m) => m[1]),
  ];
  return imports;
};

const resolveRustImportPath: LanguageImportHandler['resolveImportPath'] = async (spec, fromDir, rootDir) => {
  let baseDir = rootDir;
  let target = spec;
  if (spec.startsWith('super::')) {
    target = spec.replace(/^super::/, '');
    baseDir = path.join(rootDir, fromDir, '..');
  } else if (spec.startsWith('self::')) {
    target = spec.replace(/^self::/, '');
    baseDir = path.join(rootDir, fromDir);
  } else if (spec.startsWith('crate::')) {
    target = spec.replace(/^crate::/, '');
  } else {
    baseDir = path.join(rootDir, fromDir);
  }

  const relative = target.replace(/::/g, '/');
  const candidates = [path.join(baseDir, `${relative}.rs`), path.join(baseDir, relative, 'mod.rs')];
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

export const RustImportHandler: LanguageImportHandler = {
  extractImports: extractRustImports,
  resolveImportPath: resolveRustImportPath,
};
