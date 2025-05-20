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

describe('collectImportedFilePaths rust', () => {
  test('resolves rust module imports', async () => {
    await fs.writeFile(path.join(tempDir, 'lib.rs'), 'mod util;');
    await fs.writeFile(path.join(tempDir, 'util.rs'), '');

    const config = createMockConfig({
      include: ['lib.rs'],
      input: { imports: { enabled: true } },
    });

    const result = await collectImportedFilePaths(['lib.rs'], tempDir, config);
    expect(result).toEqual(['util.rs']);
  });
});
