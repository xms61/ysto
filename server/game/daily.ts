// The daily challenge's questions (docs/product-specs/daily.md): the day's ten songs, the same for everyone, from a
// seed of the server's secret and the day's number. The code and the catalog's sources are public, so a seed from
// the date alone would let anyone list the day's answers in advance.
import { createHmac } from 'node:crypto';
import type { LobbySettings } from '../../shared/settings.ts';
import type { Catalog } from '../catalog/load.ts';
import { buildGame } from './questions.ts';
import type { Question } from './questions.ts';
import { seededRandom } from './random.ts';

export function dailySeed(secret: string, number: number): number {
  return createHmac('sha256', secret).update(`daily:${number}`).digest().readUInt32BE(0);
}

export function dailyQuestions(catalog: Catalog, settings: LobbySettings, secret: string, number: number): Question[] {
  return buildGame(catalog, settings, seededRandom(dailySeed(secret, number)));
}
