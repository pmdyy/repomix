import fs from 'node:fs/promises';
import path from 'node:path';
import { minimatch } from 'minimatch';
import type { RepomixConfigMerged } from '../../config/configSchema.js';
import { logger } from '../../shared/logger.js';
import { readRawFile } from './fileRead.js';
import { getIgnorePatterns } from './fileSearch.js';

const possibleExtensions = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'];

const extractImports = (content: string): string[] => {
  const result: string[] = [];
  const importRegex = /import\s+(?:[^'";]+\s+from\s+)?['"]([^'";]+)['"]/g;
  const requireRegex = /require\(\s*['"]([^'";]+)['"]\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(content))) {
    result.push(match[1]);
  }
  while ((match = requireRegex.exec(content))) {
    result.push(match[1]);
  }
  return result.filter((p) => p.startsWith('.'));
};

const resolveImportPath = async (
  spec: string,
  fromDir: string,
  rootDir: string,
): Promise<string | null> => {
  const basePath = path.normalize(path.join(fromDir, spec));
  for (const ext of possibleExtensions) {
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
  for (const ext of possibleExtensions) {
    const indexPath = path.join(rootDir, basePath, 'index' + ext);
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

export const collectImportedFilePaths = async (
  filePaths: string[],
  rootDir: string,
  config: RepomixConfigMerged,
): Promise<string[]> => {
  const importsConfig = config.input.imports;
  if (!importsConfig?.enabled) {
    return [];
  }
  const maxDepth = importsConfig.maxDepth ?? 3;
  const ignorePatterns = await getIgnorePatterns(rootDir, config);

  const visited = new Set<string>(filePaths);
  const additional: string[] = [];
  const queue = filePaths.map((p) => ({ path: p, depth: 0 }));

  while (queue.length > 0) {
    const { path: current, depth } = queue.shift()!;
    if (depth >= maxDepth) continue;
    const fullPath = path.join(rootDir, current);
    const content = await readRawFile(fullPath, config.input.maxFileSize);
    if (!content) continue;
    const imports = extractImports(content);
    for (const spec of imports) {
      const resolved = await resolveImportPath(spec, path.dirname(current), rootDir);
      if (!resolved) continue;
      if (ignorePatterns.some((pattern) => minimatch(resolved, pattern))) {
        continue;
      }
      if (!visited.has(resolved)) {
        visited.add(resolved);
        additional.push(resolved);
        queue.push({ path: resolved, depth: depth + 1 });
      }
    }
  }

  logger.trace(`Collected ${additional.length} imported files`);
  return additional;
};
