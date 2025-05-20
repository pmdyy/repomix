import type { QueryCapture } from 'web-tree-sitter';
import type { RepomixConfigMerged } from '../../config/configSchema.js';
import { logger } from '../../shared/logger.js';
import type { SupportedLang } from './lang2Query.js';
import { type ParseContext, createParseStrategy } from './parseStrategies/ParseStrategy.js';
import { getLanguageParserSingleton } from './parserSingleton.js';

interface CapturedChunk {
  content: string;
  startRow: number;
  endRow: number;
}

export const CHUNK_SEPARATOR = '⋮----';

// TODO: Do something with config: RepomixConfigMerged, it is not used (yet)
export const parseFile = async (fileContent: string, filePath: string, config: RepomixConfigMerged) => {
  const languageParser = await getLanguageParserSingleton();

  // Split the file content into individual lines
  const lines = fileContent.split('\n');
  if (lines.length < 1) {
    return '';
  }

  const lang: SupportedLang | undefined = languageParser.guessTheLang(filePath);
  if (lang === undefined) {
    // Language not supported
    return undefined;
  }

  const query = await languageParser.getQueryForLang(lang);
  const parser = await languageParser.getParserForLang(lang);
  const processedChunks = new Set<string>();
  const capturedChunks: CapturedChunk[] = [];

  try {
    // Parse the file content into an Abstract Syntax Tree (AST)
    const tree = parser.parse(fileContent);

    // Get the appropriate parse strategy for the language
    const parseStrategy = createParseStrategy(lang);

    // Create parse context
    const context: ParseContext = {
      fileContent,
      lines,
      tree,
      query,
      config,
    };

    // Apply the query to the AST and get the captures
    const captures = query.captures(tree.rootNode);

    // Sort captures by their start position
    captures.sort((a, b) => a.node.startPosition.row - b.node.startPosition.row);

    for (const capture of captures) {
      const capturedChunkContent = parseStrategy.parseCapture(capture, lines, processedChunks, context);
      if (capturedChunkContent !== null) {
        capturedChunks.push({
          content: capturedChunkContent.trim(),
          startRow: capture.node.startPosition.row,
          endRow: capture.node.endPosition.row,
        });
      }
    }
  } catch (error: unknown) {
    logger.log(`Error parsing file: ${error}\n`);
  }

  const filteredChunks = filterDuplicatedChunks(capturedChunks);
  const mergedChunks = mergeAdjacentChunks(filteredChunks);

  return mergedChunks
    .map((chunk) => chunk.content)
    .join(`\n${CHUNK_SEPARATOR}\n`)
    .trim();
};

const filterDuplicatedChunks = (chunks: CapturedChunk[]): CapturedChunk[] => {
  // Group chunks by their start row
  const chunksByStartRow = new Map<number, CapturedChunk[]>();

  for (const chunk of chunks) {
    const startRow = chunk.startRow;
    if (!chunksByStartRow.has(startRow)) {
      chunksByStartRow.set(startRow, []);
    }
    chunksByStartRow.get(startRow)?.push(chunk);
  }

  // For each start row, keep the chunk with the most content
  const filteredChunks: CapturedChunk[] = [];
  for (const [_, rowChunks] of chunksByStartRow) {
    rowChunks.sort((a, b) => b.content.length - a.content.length);
    filteredChunks.push(rowChunks[0]);
  }

  // Sort filtered chunks by start row
  return filteredChunks.sort((a, b) => a.startRow - b.startRow);
};

const mergeAdjacentChunks = (chunks: CapturedChunk[]): CapturedChunk[] => {
  if (chunks.length <= 1) {
    return chunks;
  }

  const merged: CapturedChunk[] = [chunks[0]];

  for (let i = 1; i < chunks.length; i++) {
    const current = chunks[i];
    const previous = merged[merged.length - 1];

    // Merge the current chunk with the previous one
    if (previous.endRow + 1 === current.startRow) {
      previous.content += `\n${current.content}`;
      previous.endRow = current.endRow;
    } else {
      merged.push(current);
    }
  }

  return merged;
};
