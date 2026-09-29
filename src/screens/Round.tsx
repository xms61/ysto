// A round from the player's side (docs/product-specs/game-flow.md): the clip loads, a countdown runs, the
// four options appear exactly when the clip starts, and the reveal follows. Keys 1 to 4 answer too.
import { useEffect } from 'react';
import type { LobbyState } from '../../shared/protocol.ts';
import type { TitleLanguage } from '../../shared/settings.ts';
import { ConfirmButton, Panel } from '../components/ui.tsx';
import { langOf } from '../format.ts';
import { useReached, useTicker } from '../hooks.ts';
import type { ClientRound, RoundStart } from '../realtime/game-state.ts';
import type { GameStore } from '../realtime/store.ts';
import { Reveal } from './Reveal.tsx';

const TICK_MS = 250;
const OPTION_KEYS = ['1', '2', '3', '4'];

interface RoundProps {
  store: GameStore;
  lobby: LobbyState;
  round: ClientRound | null;
  titleLanguage: TitleLanguage;
  isHost: boolean;
}

function isTypingIn(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement
  );
}

// Answers from the number keys, unless a modifier is held (the browser's own shortcuts) or a field such as
// the volume has the focus.
function useAnswerKeys(store: GameStore, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat || isTypingIn(event.target)) return;
      const option = OPTION_KEYS.indexOf(event.key);
      if (option >= 0) store.answer(option);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store, active]);
}

export function Round(props: RoundProps) {
  const { lobby, round } = props;
  if (!round) {
    return (
      <Panel>
        <p aria-live="polite">{lobby.game?.number === 0 ? 'Starting the game…' : 'The next round is on its way…'}</p>
      </Panel>
    );
  }
  return <RoundView key={round.id} {...props} round={round} />;
}

// Each phase that shows time has its own ticker, which reads the clock when it mounts, so a countdown never
// starts from a time read before the round's start was known.
function Countdown({ store, startsAt }: { store: GameStore; startsAt: number }) {
  const now = useTicker(store.serverNow, TICK_MS);
  return (
    <p aria-live="polite" className="py-10 text-center">
      <span className="block text-muted">Get ready</span>
      <span className="block text-6xl font-black tabular-nums">{Math.max(1, Math.ceil((startsAt - now) / 1000))}</span>
    </p>
  );
}

interface AnsweringProps {
  store: GameStore;
  lobby: LobbyState;
  round: ClientRound;
  start: RoundStart;
  titleLanguage: TitleLanguage;
}

function Answering({ store, lobby, round, start, titleLanguage }: AnsweringProps) {
  const now = useTicker(store.serverNow, TICK_MS);
  const spectating = lobby.players.find((player) => player.id === lobby.you)?.spectating ?? false;
  const answered = round.choice !== null || round.answeredIds.includes(lobby.you);
  const timeUp = now >= start.endsAt;
  const canAnswer = !spectating && !answered && !timeUp;
  useAnswerKeys(store, canAnswer);
  const elapsed = (now - start.startsAt) / (start.endsAt - start.startsAt);
  const players = lobby.players.filter((player) => !player.spectating).length;

  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <div aria-hidden="true" className="h-2 flex-1 overflow-hidden rounded-full bg-raised">
          <div
            className="h-full bg-accent transition-[width] duration-300 ease-linear"
            style={{ width: `${Math.min(100, Math.max(0, elapsed * 100))}%` }}
          />
        </div>
        <p className="w-16 text-right tabular-nums">{Math.max(0, Math.ceil((start.endsAt - now) / 1000))} s left</p>
      </div>
      <ol aria-label="Options" className="grid gap-3 sm:grid-cols-2">
        {start.options[titleLanguage].map((title, index) => (
          <li key={index}>
            <button
              type="button"
              disabled={!canAnswer}
              aria-pressed={round.choice === index}
              onClick={() => store.answer(index)}
              className={
                'flex min-h-16 w-full items-center gap-3 rounded-xl border-2 p-3 text-left text-lg font-semibold ' +
                'transition enabled:hover:border-accent disabled:cursor-default ' +
                (round.choice === index ? 'border-accent bg-raised' : 'border-line bg-page')
              }
            >
              <kbd aria-hidden="true" className="rounded-md border border-line px-2 font-mono text-sm text-muted">
                {index + 1}
              </kbd>
              <span lang={langOf(titleLanguage)}>{title}</span>
            </button>
          </li>
        ))}
      </ol>
      <p aria-live="polite" className="mt-4 text-muted">
        {spectating
          ? "You joined during this round. You'll play from the next one."
          : answered
            ? 'Locked in. Waiting for the others.'
            : timeUp
              ? "Time's up."
              : 'Pick the anime, or press 1 to 4.'}
      </p>
      <p className="mt-2 text-sm text-muted">
        {round.answeredIds.length} of {players} answered
      </p>
    </>
  );
}

function RoundView({ store, lobby, round, titleLanguage, isHost }: RoundProps & { round: ClientRound }) {
  const { start, reveal } = round;
  const started = useReached(store.serverNow, start?.startsAt ?? null);
  return (
    <Panel>
      <h2 className="mb-4 text-lg font-bold">
        Round {round.number} of {round.rounds}
      </h2>
      {reveal ? (
        <Reveal round={round} reveal={reveal} lobby={lobby} titleLanguage={titleLanguage} />
      ) : !start ? (
        <p aria-live="polite" className="py-10 text-center text-xl">
          Get ready…
        </p>
      ) : !started ? (
        <Countdown store={store} startsAt={start.startsAt} />
      ) : (
        <Answering store={store} lobby={lobby} round={round} start={start} titleLanguage={titleLanguage} />
      )}
      {isHost && !reveal && (
        <div className="mt-4 flex justify-end">
          <ConfirmButton
            label="Skip round"
            question="Skip this round for everyone?"
            onConfirm={() => store.skipRound()}
          />
        </div>
      )}
    </Panel>
  );
}
