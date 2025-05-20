import path from 'node:path';
import { minimatch } from 'minimatch';
import type { RepomixConfigMerged } from '../../config/configSchema.js';
import { logger } from '../../shared/logger.js';
import { readRawFile } from './fileRead.js';
import { getIgnorePatterns } from './fileSearch.js';
import { getImportHandler } from './importHandlers/index.js';

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
    const next = queue.shift();
    if (!next) break;
    const { path: current, depth } = next;
    if (depth >= maxDepth) continue;
    const fullPath = path.join(rootDir, current);
    const content = await readRawFile(fullPath, config.input.maxFileSize);
    if (!content) continue;
    const handler = getImportHandler(path.extname(current));
    if (!handler) continue;
    const imports = await handler.extractImports(content);
    for (const spec of imports) {
      const resolved = await handler.resolveImportPath(spec, path.dirname(current), rootDir);
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
