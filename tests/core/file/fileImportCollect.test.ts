import * as fs from 'node:fs/promises';
import { describe, expect, test, vi } from 'vitest';
import { collectImportedFiles } from '../../../src/core/file/fileImportCollect.js';

vi.mock('node:fs/promises');

describe('collectImportedFiles', () => {
  test('collects imports recursively up to depth', async () => {
    const files: Record<string, string> = {
      '/root/main.js': "import './a.js'; const b = require('./b');",
      '/root/a.js': "export * from './c.js';",
      '/root/b.js': '',
      '/root/c.js': '',
    };
    vi.mocked(fs.readFile).mockImplementation(async (p: any) => files[p as string] || '');
    vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true } as any);

    const result = await collectImportedFiles(['main.js'], '/root', 2);
    expect(result.sort()).toEqual(['a.js', 'b.js', 'c.js'].sort());
  });

  test('collects python imports', async () => {
    const files: Record<string, string> = {
      '/root/main.py': 'from .pkg import mod\nimport util',
      '/root/pkg/mod.py': '',
      '/root/util.py': '',
    };
    vi.mocked(fs.readFile).mockImplementation(async (p: any) => files[p as string] || '');
    vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true } as any);

    const result = await collectImportedFiles(['main.py'], '/root', 1);
    expect(result.sort()).toEqual(['pkg/mod.py', 'util.py'].sort());
  });

  test('collects rust mod and include', async () => {
    const files: Record<string, string> = {
      '/root/main.rs': 'mod foo;\ninclude!("bar.rs");',
      '/root/foo.rs': '',
      '/root/bar.rs': '',
    };
    vi.mocked(fs.readFile).mockImplementation(async (p: any) => files[p as string] || '');
    vi.mocked(fs.stat).mockResolvedValue({ isFile: () => true } as any);

    const result = await collectImportedFiles(['main.rs'], '/root', 1);
    expect(result.sort()).toEqual(['bar.rs', 'foo.rs'].sort());
  });
});
