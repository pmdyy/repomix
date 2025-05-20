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
    await fs.writeFile(path.join(tempDir, 'utils.js'), "import { helper } from './helper.js'; export function greet() {};");
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

  test('handles circular imports', async () => {
    await fs.writeFile(path.join(tempDir, 'index.js'), "import './a.js';");
    await fs.writeFile(path.join(tempDir, 'a.js'), "import './index.js';");

    const config = createMockConfig({
      include: ['index.js'],
      input: { imports: { enabled: true, maxDepth: 5 } },
    });

    const result = await collectImportedFilePaths(['index.js'], tempDir, config);
    expect(result).toEqual(['a.js']);
  });

  test('skips ignored imports', async () => {
    await fs.writeFile(path.join(tempDir, 'index.js'), "import './ignored.js';");
    await fs.writeFile(path.join(tempDir, 'ignored.js'), 'console.log(1);');

    const config = createMockConfig({
      include: ['index.js'],
      input: { imports: { enabled: true } },
      ignore: { customPatterns: ['ignored.js'] },
    });

    const result = await collectImportedFilePaths(['index.js'], tempDir, config);
    expect(result).toEqual([]);
  });

  test('ignores missing imported files', async () => {
    await fs.writeFile(path.join(tempDir, 'index.js'), "import './missing.js';");

    const config = createMockConfig({
      include: ['index.js'],
      input: { imports: { enabled: true } },
    });

    const result = await collectImportedFilePaths(['index.js'], tempDir, config);
    expect(result).toEqual([]);
  });

  test('resolves extensionless imports', async () => {
    await fs.writeFile(path.join(tempDir, 'index.js'), "import './utils';");
    await fs.writeFile(path.join(tempDir, 'utils.ts'), 'export const x = 1;');

    const config = createMockConfig({
      include: ['index.js'],
      input: { imports: { enabled: true } },
    });

    const result = await collectImportedFilePaths(['index.js'], tempDir, config);
    expect(result).toEqual(['utils.ts']);
  });

  test('supports require syntax', async () => {
    await fs.writeFile(
      path.join(tempDir, 'index.js'),
      "const u = require('./util.js');",
    );
    await fs.writeFile(path.join(tempDir, 'util.js'), "import './helper.js';");
    await fs.writeFile(path.join(tempDir, 'helper.js'), 'console.log(1);');

    const config = createMockConfig({
      include: ['index.js'],
      input: { imports: { enabled: true } },
    });

    const result = await collectImportedFilePaths(['index.js'], tempDir, config);
    expect(result.sort()).toEqual(['helper.js', 'util.js'].sort());
  });

  test('deduplicates imports from multiple entry files', async () => {
    await fs.writeFile(path.join(tempDir, 'index.js'), "import './a.js';");
    await fs.writeFile(path.join(tempDir, 'other.js'), "import './a.js';");
    await fs.writeFile(path.join(tempDir, 'a.js'), 'console.log(1);');

    const config = createMockConfig({
      include: ['index.js', 'other.js'],
      input: { imports: { enabled: true } },
    });

    const result = await collectImportedFilePaths(
      ['index.js', 'other.js'],
      tempDir,
      config,
    );
    expect(result).toEqual(['a.js']);
  });
});
