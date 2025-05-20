import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { collectImportedFilePaths } from '../../../src/core/file/importResolver.js';
import { createMockConfig } from '../../testing/testUtils.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repomix-import-'));
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe('collectImportedFilePaths python', () => {
  test('resolves python relative imports', async () => {
    await fs.writeFile(path.join(tempDir, 'index.py'), 'from .pkg import helper\n');
    await fs.mkdir(path.join(tempDir, 'pkg'));
    await fs.writeFile(path.join(tempDir, 'pkg', '__init__.py'), '');
    await fs.writeFile(path.join(tempDir, 'pkg', 'helper.py'), 'def helper(): pass');

    const config = createMockConfig({
      include: ['index.py'],
      input: { imports: { enabled: true } },
    });

    const result = await collectImportedFilePaths(['index.py'], tempDir, config);
    expect(result).toEqual(['pkg/helper.py']);
  });

  test('resolves python absolute imports for local modules', async () => {
    await fs.writeFile(path.join(tempDir, 'index.py'), 'from pkg.helper import func\n');
    await fs.mkdir(path.join(tempDir, 'pkg'));
    await fs.writeFile(path.join(tempDir, 'pkg', '__init__.py'), '');
    await fs.writeFile(path.join(tempDir, 'pkg', 'helper.py'), 'def func(): pass');

    const config = createMockConfig({
      include: ['index.py'],
      input: { imports: { enabled: true } },
    });

    const result = await collectImportedFilePaths(['index.py'], tempDir, config);
    expect(result).toEqual(['pkg/helper.py']);
  });
});
