import { LanguageParser } from './languageParser.js';

let languageParserSingleton: LanguageParser | null = null;

export const getLanguageParserSingleton = async (): Promise<LanguageParser> => {
  if (!languageParserSingleton) {
    languageParserSingleton = new LanguageParser();
    await languageParserSingleton.init();
  }
  return languageParserSingleton;
};
