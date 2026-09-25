// Scoring: the modes, modifiers and presets of docs/product-specs/scoring.md. Shared so the client can
// explain the rules, but only the server scores. Pure: the same answers always give the same points.

export type ScoringMode = 'speed' | 'firstCorrect' | 'flat';

export interface ScoringRules {
  mode: ScoringMode;
  streakBonus: boolean;
  comeback: boolean;
  wrongAnswerPenalty: boolean;
}

export const SCORING_PRESETS = {
  classic: { mode: 'speed', streakBonus: true, comeback: false, wrongAnswerPenalty: false },
  buzzer: { mode: 'firstCorrect', streakBonus: false, comeback: false, wrongAnswerPenalty: true },
  chill: { mode: 'flat', streakBonus: false, comeback: false, wrongAnswerPenalty: false },
} as const satisfies Record<string, ScoringRules>;

export type ScoringPreset = keyof typeof SCORING_PRESETS;

export const POINTS = {
  full: 1000,
  streakStep: 100,
  streakCap: 500,
  penalty: 250,
  firstCorrectPenalty: 500,
} as const;

// Answers in the order they arrived, which breaks exact ties in First correct. responseMs is measured by
// the server (docs/design-docs/anti-cheat.md).
export interface Answer {
  playerId: string;
  correct: boolean;
  responseMs: number;
}

// A player's total and current run of correct answers before the question.
export interface Standing {
  playerId: string;
  score: number;
  streak: number;
}

// Points for this question, and the run of correct answers after it.
export interface Award {
  playerId: string;
  points: number;
  streak: number;
}

function basePoints(rules: ScoringRules, answer: Answer, windowMs: number, firstCorrectId: string | undefined): number {
  if (rules.mode === 'flat') return POINTS.full;
  if (rules.mode === 'firstCorrect') return answer.playerId === firstCorrectId ? POINTS.full : 0;
  const elapsed = Math.min(Math.max(answer.responseMs, 0), windowMs);
  return Math.round(POINTS.full * (1 - (0.5 * elapsed) / windowMs));
}

function streakBonus(rules: ScoringRules, streak: number, behindLeader: boolean): number {
  if (!rules.streakBonus || streak < 2) return 0;
  const bonus = Math.min(POINTS.streakStep * (streak - 1), POINTS.streakCap);
  return rules.comeback && behindLeader ? 2 * bonus : bonus;
}

function penalty(rules: ScoringRules): number {
  if (!rules.wrongAnswerPenalty) return 0;
  return rules.mode === 'firstCorrect' ? POINTS.firstCorrectPenalty : POINTS.penalty;
}

// Scores one question for every player in the standings. A player who didn't answer gets nothing and loses
// their run. A streak bonus only rides on base points, so in First correct only the winner gets one.
export function scoreQuestion(
  rules: ScoringRules,
  windowMs: number,
  answers: Answer[],
  standings: Standing[],
): Award[] {
  const answerOf = new Map(answers.map((answer) => [answer.playerId, answer]));
  const leaderScore = Math.max(...standings.map((standing) => standing.score));
  const firstCorrectId = answers
    .filter((answer) => answer.correct)
    .sort((a, b) => a.responseMs - b.responseMs)[0]?.playerId;
  return standings.map(({ playerId, score, streak }) => {
    const answer = answerOf.get(playerId);
    if (!answer) return { playerId, points: 0, streak: 0 };
    if (!answer.correct) return { playerId, points: 0 - penalty(rules), streak: 0 };
    const nextStreak = streak + 1;
    const base = basePoints(rules, answer, windowMs, firstCorrectId);
    const bonus = base > 0 ? streakBonus(rules, nextStreak, score < leaderScore) : 0;
    return { playerId, points: base + bonus, streak: nextStreak };
  });
}

export interface Tally {
  playerId: string;
  score: number;
  correctResponseMs: number; // total response time of the player's correct answers
}

// Highest score first; equal scores rank the faster player (less total time on correct answers) higher.
export function rankPlayers(tallies: Tally[]): Tally[] {
  return [...tallies].sort((a, b) => b.score - a.score || a.correctResponseMs - b.correctResponseMs);
}
