import { JavaScriptImportHandler, jsExtensions } from './JavaScriptImportHandler.js';
import type { LanguageImportHandler } from './LanguageImportHandler.js';
import { PythonImportHandler } from './PythonImportHandler.js';
import { RustImportHandler } from './RustImportHandler.js';

const handlers: Record<string, LanguageImportHandler> = {};

for (const ext of jsExtensions) {
  handlers[ext] = JavaScriptImportHandler;
}
handlers['.py'] = PythonImportHandler;
handlers['.rs'] = RustImportHandler;

export const getImportHandler = (ext: string): LanguageImportHandler | null => {
  return handlers[ext] ?? null;
};

export type { LanguageImportHandler } from './LanguageImportHandler.js';
