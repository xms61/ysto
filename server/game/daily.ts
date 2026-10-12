// The daily challenges' questions (docs/product-specs/daily.md): each daily's ten songs, the same for everyone, from a
// seed of the server's secret, the day's number and the daily. The code and the catalog's sources are public, so a seed from
// the date alone would let anyone list the day's answers in advance.
import { createHmac } from 'node:crypto';
import type { DailyLobby, DailyMode } from '../../shared/daily.ts';
import type { LobbySettings } from '../../shared/settings.ts';
import type { Catalog } from '../catalog/load.ts';
import { buildGame } from './questions.ts';
import type { Question } from './questions.ts';
import { seededRandom } from './random.ts';

// Both keeps the seed the single daily had, so its songs didn't change when the other two came.
function seedInput(number: number, mode: DailyMode): string {
  return mode === 'both' ? `daily:${number}` : `daily:${number}:${mode}`;
}

export function dailySeed(secret: string, { number, mode }: DailyLobby): number {
  return createHmac('sha256', secret).update(seedInput(number, mode)).digest().readUInt32BE(0);
}

export function dailyQuestions(
  catalog: Catalog,
  settings: LobbySettings,
  secret: string,
  daily: DailyLobby,
): Question[] {
  return buildGame(catalog, settings, seededRandom(dailySeed(secret, daily)));
}
