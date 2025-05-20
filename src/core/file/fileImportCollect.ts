import fs from 'node:fs/promises';
import path from 'node:path';
import { logger } from '../../shared/logger.js';

/**
 * Handler for extracting and resolving imports for a specific language.
 */
interface ImportHandler {
  extensions: string[];
  extract: (content: string) => string[];
  resolve: (
    importPath: string,
    fromFile: string,
    rootDir: string,
  ) => Promise<string | null>;
}

// -------- JavaScript/TypeScript --------
const JS_IMPORT_RE = /import(?:[^'";]*?from\s*)?["']([^"']+)["']/g;
const REQUIRE_RE = /require\(["']([^"']+)["']\)/g;
const EXPORT_RE = /export\s+[^'";]*?from\s*["']([^"']+)["']/g;

const extractJsImports = (content: string): string[] => {
  const paths = new Set<string>();
  for (const regex of [JS_IMPORT_RE, REQUIRE_RE, EXPORT_RE]) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      paths.add(match[1]);
    }
  }
  return Array.from(paths);
};

const resolveJSImport = async (
  importPath: string,
  fromFile: string,
  rootDir: string,
): Promise<string | null> => {
  if (!importPath.startsWith('.')) {
    return null;
  }
  const baseDir = path.dirname(path.resolve(rootDir, fromFile));
  const candidates = [
    importPath,
    `${importPath}.ts`,
    `${importPath}.js`,
    `${importPath}.tsx`,
    `${importPath}.jsx`,
    path.join(importPath, 'index.ts'),
    path.join(importPath, 'index.js'),
  ];
  for (const candidate of candidates) {
    const resolved = path.relative(rootDir, path.resolve(baseDir, candidate));
    try {
      const stat = await fs.stat(path.resolve(rootDir, resolved));
      if (stat.isFile()) {
        return resolved;
      }
    } catch {
      // ignore
    }
  }
  return null;
};

const jsHandler: ImportHandler = {
  extensions: ['.js', '.jsx', '.ts', '.tsx'],
  extract: extractJsImports,
  resolve: resolveJSImport,
};

// -------- C/C++ (for #include) --------
const INCLUDE_RE = /#include\s+[<"]([^">]+)[">]/g;

const extractCImports = (content: string): string[] => {
  const paths: string[] = [];
  INCLUDE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INCLUDE_RE.exec(content)) !== null) {
    paths.push(match[1]);
  }
  return paths;
};

const resolveCImport = async (
  importPath: string,
  fromFile: string,
  rootDir: string,
): Promise<string | null> => {
  if (!importPath.startsWith('.')) {
    return null;
  }
  const baseDir = path.dirname(path.resolve(rootDir, fromFile));
  const resolved = path.relative(rootDir, path.resolve(baseDir, importPath));
  try {
    const stat = await fs.stat(path.resolve(rootDir, resolved));
    if (stat.isFile()) {
      return resolved;
    }
  } catch {
    // ignore
  }
  return null;
};

const cHandler: ImportHandler = {
  extensions: ['.c', '.cpp', '.h', '.hpp'],
  extract: extractCImports,
  resolve: resolveCImport,
};

// -------- Python --------
const PY_FROM_RE = /^\s*from\s+([.\w]+)\s+import/m;
const PY_IMPORT_RE = /^\s*import\s+([.\w, ]+)/m;

const extractPythonImports = (content: string): string[] => {
  const imports = new Set<string>();
  const lines = content.split('\n');
  for (const line of lines) {
    let match = line.match(PY_FROM_RE);
    if (match) {
      imports.add(match[1]);
      continue;
    }
    match = line.match(PY_IMPORT_RE);
    if (match) {
      for (const part of match[1].split(',')) {
        const trimmed = part.trim();
        if (trimmed) imports.add(trimmed);
      }
    }
  }
  return Array.from(imports);
};

const resolvePythonImport = async (
  importPath: string,
  fromFile: string,
  rootDir: string,
): Promise<string | null> => {
  const baseDir = path.dirname(path.resolve(rootDir, fromFile));

  const leadingDots = importPath.match(/^\.+/);
  let targetDir = baseDir;
  let relative = importPath;

  if (leadingDots) {
    // Relative import like ..module.utils
    const level = leadingDots[0].length;
    relative = importPath.slice(level);
    for (let i = 1; i < level; i += 1) {
      targetDir = path.dirname(targetDir);
    }
  } else {
    // Absolute import from project root
    targetDir = rootDir;
  }

  if (!relative) {
    return null;
  }

  const modulePath = relative.replace(/\./g, '/');
  const candidates = [
    `${modulePath}.py`,
    path.join(modulePath, '__init__.py'),
  ];

  for (const candidate of candidates) {
    const resolved = path.relative(rootDir, path.resolve(targetDir, candidate));
    try {
      const stat = await fs.stat(path.resolve(rootDir, resolved));
      if (stat.isFile()) {
        return resolved;
      }
    } catch {
      // ignore
    }
  }

  return null;
};

const pythonHandler: ImportHandler = {
  extensions: ['.py'],
  extract: extractPythonImports,
  resolve: resolvePythonImport,
};

// -------- Rust --------
const RUST_MOD_RE = /(?:^|\s)(?:pub\s+)?mod\s+([A-Za-z0-9_]+)\s*;/gm;
const RUST_INCLUDE_RE = /include!\s*\(\s*"([^"]+)"\s*\)/gm;

const extractRustImports = (content: string): string[] => {
  const imports = new Set<string>();
  for (const regex of [RUST_MOD_RE, RUST_INCLUDE_RE]) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      imports.add(match[1]);
    }
  }
  return Array.from(imports);
};

const resolveRustImport = async (
  importPath: string,
  fromFile: string,
  rootDir: string,
): Promise<string | null> => {
  const baseDir = path.dirname(path.resolve(rootDir, fromFile));

  const candidates = importPath.endsWith('.rs')
    ? [importPath]
    : [`${importPath}.rs`, path.join(importPath, 'mod.rs')];

  for (const candidate of candidates) {
    const resolved = path.relative(rootDir, path.resolve(baseDir, candidate));
    try {
      const stat = await fs.stat(path.resolve(rootDir, resolved));
      if (stat.isFile()) {
        return resolved;
      }
    } catch {
      // ignore
    }
  }

  return null;
};

const rustHandler: ImportHandler = {
  extensions: ['.rs'],
  extract: extractRustImports,
  resolve: resolveRustImport,
};

const handlers: ImportHandler[] = [
  jsHandler,
  cHandler,
  pythonHandler,
  rustHandler,
];

const getHandlersForExt = (ext: string): ImportHandler[] =>
  handlers.filter((h) => h.extensions.includes(ext));

export const collectImportedFiles = async (
  startFiles: string[],
  rootDir: string,
  maxDepth: number,
): Promise<string[]> => {
  const queue: Array<{ file: string; depth: number }> = startFiles.map((f) => ({
    file: f,
    depth: 0,
  }));
  const visited = new Set<string>();
  const results = new Set<string>();

  while (queue.length > 0) {
    const { file, depth } = queue.shift()!;
    if (depth >= maxDepth) continue;

    let content: string;
    try {
      content = await fs.readFile(path.resolve(rootDir, file), 'utf8');
    } catch (err) {
      logger.debug(`collectImportedFiles: failed to read ${file}: ${err}`);
      continue;
    }

    const ext = path.extname(file);
    for (const handler of getHandlersForExt(ext)) {
      const importPaths = handler.extract(content);
      for (const imp of importPaths) {
        const resolved = await handler.resolve(imp, file, rootDir);
        if (resolved && !visited.has(resolved)) {
          visited.add(resolved);
          results.add(resolved);
          queue.push({ file: resolved, depth: depth + 1 });
        }
      }
    }
  }

  return Array.from(results);
};
