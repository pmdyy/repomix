export interface LanguageImportHandler {
  extractImports(content: string): Promise<string[]>;
  resolveImportPath(spec: string, fromDir: string, rootDir: string): Promise<string | null>;
}
