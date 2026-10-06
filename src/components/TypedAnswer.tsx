// Answering by typing (docs/product-specs/game-flow.md): a field in place of the cards. As the player types, the
// server suggests anime from the whole catalog, each with its year so remakes can be told apart; picking one
// answers, and so does Enter on text that names exactly one suggestion. At the reveal, what each player typed.
import { useEffect, useRef, useState } from 'react';
import type { LobbyState, RoundReveal, TitleMatch } from '../../shared/protocol.ts';
import { normalizeTitle } from '../../shared/titles.ts';
import { animeTitle } from '../format.ts';
import type { TitleLanguages } from '../format.ts';
import type { ClientRound } from '../realtime/game-state.ts';
import type { GameStore } from '../realtime/store.ts';
import { PlayerBadge } from './PlayerIcon.tsx';
import { CheckIcon, CrossIcon, INPUT } from './ui.tsx';

const SEARCH_DELAY_MS = 150;

export function matchText(match: TitleMatch, titles: TitleLanguages): string {
  const title = animeTitle(match, titles.first).text;
  return match.year === null ? title : `${title} (${match.year})`;
}

// The one suggestion the text names exactly, in any language, or none.
function exactMatch(text: string, matches: TitleMatch[]): TitleMatch | null {
  const key = normalizeTitle(text);
  const named = matches.filter((match) =>
    [match.english, match.romaji, match.japanese].some((title) => title !== null && normalizeTitle(title) === key),
  );
  return named.length === 1 ? (named[0] ?? null) : null;
}

function useSuggestions(store: GameStore, query: string): TitleMatch[] {
  const [found, setFound] = useState<{ query: string; matches: TitleMatch[] }>({ query: '', matches: [] });
  useEffect(() => store.onTitles((answered, matches) => setFound({ query: answered, matches })), [store]);
  useEffect(() => {
    if (normalizeTitle(query).length < 2) return;
    const timer = setTimeout(() => store.searchTitles(query), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [store, query]);
  return found.query === query ? found.matches : [];
}

interface TypedAnswerProps {
  store: GameStore;
  round: ClientRound;
  titles: TitleLanguages;
  canAnswer: boolean;
}

export function TypedAnswer({ store, round, titles, canAnswer }: TypedAnswerProps) {
  const [query, setQuery] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const matches = useSuggestions(store, query);
  useEffect(() => {
    if (canAnswer) field.current?.focus({ preventScroll: true });
  }, [canAnswer]);
  const answer = (match: TitleMatch) => {
    store.answerTyped(match);
    setQuery('');
    setProblem(null);
  };
  return (
    <div className="typed-answer">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const match = exactMatch(query, matches);
          if (match) answer(match);
          else setProblem('Pick one of the suggestions.');
        }}
      >
        <label className="flex flex-col gap-1.5 font-medium">
          Type the anime
          <input
            ref={field}
            className={INPUT}
            value={query}
            maxLength={80}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="send"
            disabled={!canAnswer}
            aria-describedby="typed-problem"
            onChange={(event) => {
              setQuery(event.target.value);
              setProblem(null);
            }}
          />
        </label>
      </form>
      <p id="typed-problem" className="min-h-6 text-sm text-muted" aria-live="polite">
        {problem}
      </p>
      {canAnswer && matches.length > 0 && (
        <ul aria-label="Suggestions" className="typed-suggestions">
          {matches.map((match) => (
            <li key={match.animeId}>
              <button type="button" className="typed-suggestion" onClick={() => answer(match)}>
                {matchText(match, titles)}
              </button>
            </li>
          ))}
        </ul>
      )}
      {round.typed && (
        <p className="typed-mine" role="status">
          <span className="text-muted">Your answer:</span> <strong>{matchText(round.typed, titles)}</strong>
        </p>
      )}
    </div>
  );
}

// At the reveal: the answer, then what each player typed, right or wrong.
export function TypedReveal({
  reveal,
  lobby,
  titles,
}: {
  reveal: RoundReveal;
  lobby: LobbyState;
  titles: TitleLanguages;
}) {
  return (
    <ol aria-label="Typed answers" className="typed-reveal">
      {reveal.picks.map((pick) => {
        const player = lobby.players.find((candidate) => candidate.id === pick.playerId);
        const right = pick.typed !== undefined && pick.typed.animeId === reveal.animeId;
        return (
          <li key={pick.playerId} className="typed-row" data-right={right || undefined}>
            {player && <PlayerBadge icon={player.icon} />}
            <span className="font-medium">{player?.name}</span>
            <span className="ml-auto flex items-center gap-1.5">
              {pick.typed ? (
                <>
                  {right ? <CheckIcon /> : <CrossIcon />}
                  {matchText(pick.typed, titles)}
                </>
              ) : (
                <span className="text-muted">no answer</span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
