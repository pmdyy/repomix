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

describe('collectImportedFilePaths', () => {
  test('collects imported files recursively', async () => {
    await fs.writeFile(path.join(tempDir, 'index.js'), "import { greet } from './utils.js';");
    await fs.writeFile(
      path.join(tempDir, 'utils.js'),
      "import { helper } from './helper.js'; export function greet() {};",
    );
    await fs.writeFile(path.join(tempDir, 'helper.js'), 'export const helper = () => {}');

    const config = createMockConfig({
      include: ['index.js'],
      input: { imports: { enabled: true, maxDepth: 2 } },
    });

    const result = await collectImportedFilePaths(['index.js'], tempDir, config);
    expect(result.sort()).toEqual(['helper.js', 'utils.js'].sort());
  });

  test('respects maxDepth', async () => {
    await fs.writeFile(path.join(tempDir, 'index.js'), "import './a.js';");
    await fs.writeFile(path.join(tempDir, 'a.js'), "import './b.js';");
    await fs.writeFile(path.join(tempDir, 'b.js'), 'console.log(1);');

    const config = createMockConfig({
      include: ['index.js'],
      input: { imports: { enabled: true, maxDepth: 1 } },
    });

    const result = await collectImportedFilePaths(['index.js'], tempDir, config);
    expect(result).toEqual(['a.js']);
  });
});
