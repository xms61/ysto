// Prepares a round's clip (docs/design-docs/audio-clips.md). When ffmpeg fails on a theme, the round moves
// to another theme, up to three in all. Each failure is logged once, and players never see it.
import type { Question } from '../game/questions.ts';
import type { CutClip } from './cut.ts';

export const THEMES_PER_ROUND = 3;

export interface PreparedClip {
  question: Question;
  audio: Buffer;
}

export interface PrepareDeps {
  cut: CutClip;
  // Another question for the round, avoiding the anime of the themes already tried.
  replace: (tried: readonly Question[]) => Question;
  log: (line: string) => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function prepareClip(question: Question, { cut, replace, log }: PrepareDeps): Promise<PreparedClip> {
  const tried: Question[] = [];
  let current = question;
  for (;;) {
    try {
      return { question: current, audio: await cut(current.clip) };
    } catch (error) {
      tried.push(current);
      log(`Clip for theme ${current.themeId} failed (${tried.length} of ${THEMES_PER_ROUND}): ${errorMessage(error)}`);
      if (tried.length === THEMES_PER_ROUND) {
        throw new Error(`No clip after ${THEMES_PER_ROUND} themes`, { cause: error });
      }
      current = replace(tried);
    }
  }
}
