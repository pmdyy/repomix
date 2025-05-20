export interface LanguageImportHandler {
  extractImports(content: string): string[];
  resolveImportPath(spec: string, fromDir: string, rootDir: string): Promise<string | null>;
}
