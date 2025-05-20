import fs from 'node:fs/promises';
import path from 'node:path';
import type { SyntaxNode } from 'web-tree-sitter';
import { getLanguageParserSingleton } from '../../treeSitter/parserSingleton.js';
import type { LanguageImportHandler } from './LanguageImportHandler.js';

export const jsExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'];

const extractJsImports = async (content: string): Promise<string[]> => {
  const parser = await (await getLanguageParserSingleton()).getParserForLang('typescript');
  const tree = parser.parse(content);
  const imports: string[] = [];

  const visit = (node: SyntaxNode) => {
    if (node.type === 'import_statement') {
      const source = node.childForFieldName('source');
      if (source) {
        const text = source.text.slice(1, -1);
        if (text.startsWith('.')) {
          imports.push(text);
        }
      }
    } else if (node.type === 'call_expression') {
      const callee = node.child(0);
      if (callee?.type === 'identifier' && (callee.text === 'require' || callee.text === 'import')) {
        const args = node.childForFieldName('arguments');
        const arg = args?.namedChildren?.[0];
        if (arg && arg.type === 'string') {
          const text = arg.text.slice(1, -1);
          if (text.startsWith('.')) {
            imports.push(text);
          }
        }
      }
    }
    for (const child of node.namedChildren) visit(child);
  };

  visit(tree.rootNode);
  return imports;
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
