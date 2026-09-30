// A round from the player's side (docs/product-specs/game-flow.md): four cards dealt face down while the clip
// loads and the countdown runs, turned face up exactly when the clip starts, then the reveal. Keys 1 to 4
// answer too.
import { useEffect } from 'react';
import type { LobbyState } from '../../shared/protocol.ts';
import { POINTS } from '../../shared/scoring.ts';
import type { ScoringRules } from '../../shared/scoring.ts';
import type { TitleLanguage } from '../../shared/settings.ts';
import { Listening } from '../components/Listening.tsx';
import { FaceDownCards, OptionCard } from '../components/OptionCard.tsx';
import type { CardState } from '../components/OptionCard.tsx';
import { MODE_LABELS } from '../components/SettingsForm.tsx';
import { Stage } from '../components/Stage.tsx';
import { ConfirmButton, Panel } from '../components/ui.tsx';
import { langOf } from '../format.ts';
import { useReached, useTicker } from '../hooks.ts';
import type { ClientRound, RoundStart } from '../realtime/game-state.ts';
import type { ClipStatus, GameStore } from '../realtime/store.ts';
import { Reveal } from './Reveal.tsx';

const TICK_MS = 250;
const OPTION_KEYS = ['1', '2', '3', '4'];

interface RoundProps {
  store: GameStore;
  lobby: LobbyState;
  round: ClientRound | null;
  titleLanguage: TitleLanguage;
  isHost: boolean;
  clip: ClipStatus | null; // this player's clip for the round in progress
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

// What a round is worth, stated where the answer is given: a wrong answer can cost points.
function scoringLine(rules: ScoringRules): string {
  const penalty = rules.mode === 'firstCorrect' ? POINTS.firstCorrectPenalty : POINTS.penalty;
  return [
    MODE_LABELS[rules.mode],
    rules.streakBonus && 'streak bonus',
    rules.comeback && 'comeback',
    rules.wrongAnswerPenalty && `wrong answers cost ${penalty}`,
  ]
    .filter((part) => part !== false)
    .join(' · ');
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
  const seconds = Math.max(1, Math.ceil((startsAt - now) / 1000));
  return (
    <p aria-live="polite" className="flex items-baseline gap-4">
      <span className="text-muted">Get ready</span>
      <span key={seconds} className="display motion-tick text-6xl tabular-nums">
        {seconds}
      </span>
    </p>
  );
}

interface AnsweringProps {
  store: GameStore;
  lobby: LobbyState;
  round: ClientRound;
  start: RoundStart;
  titleLanguage: TitleLanguage;
  clip: ClipStatus | null;
}

function cardState(round: ClientRound, answered: boolean, index: number): CardState {
  if (round.choice === index) return 'chosen';
  return answered ? 'muted' : 'open';
}

function Answering({ store, lobby, round, start, titleLanguage, clip }: AnsweringProps) {
  const now = useTicker(store.serverNow, TICK_MS);
  const spectating = lobby.players.find((player) => player.id === lobby.you)?.spectating ?? false;
  const answered = round.choice !== null || round.answeredIds.includes(lobby.you);
  const timeUp = now >= start.endsAt;
  const canAnswer = !spectating && !answered && !timeUp;
  useAnswerKeys(store, canAnswer);
  const elapsed = Math.min(1, Math.max(0, (now - start.startsAt) / (start.endsAt - start.startsAt)));
  const players = lobby.players.filter((player) => !player.spectating).length;

  const timer = (
    <div className="flex items-center gap-3">
      <div aria-hidden="true" className="h-2 flex-1 overflow-hidden rounded-full bg-raised">
        <div
          className="h-full origin-left bg-accent transition-transform duration-300 ease-linear"
          style={{ transform: `scaleX(${1 - elapsed})` }}
        />
      </div>
      <p className="w-16 text-right tabular-nums">{Math.max(0, Math.ceil((start.endsAt - now) / 1000))} s left</p>
    </div>
  );
  const cards = (
    <ol aria-label="Options" className="grid grid-cols-2 gap-3">
      {start.options[titleLanguage].map((title, index) => (
        <li key={index}>
          <OptionCard
            index={index}
            title={title}
            lang={langOf(titleLanguage)}
            state={cardState(round, answered, index)}
            tag={round.choice === index ? 'Your pick' : undefined}
            disabled={!canAnswer}
            onPick={() => store.answer(index)}
          />
        </li>
      ))}
    </ol>
  );
  const below = (
    <>
      <p aria-live="polite" className="text-muted">
        {spectating ? (
          "You joined during this round. You'll play from the next one."
        ) : answered ? (
          'Locked in. Waiting for the others.'
        ) : timeUp ? (
          "Time's up."
        ) : (
          <>
            Pick the anime.
            {/* Keys only help where there is a keyboard, which a mouse or trackpad suggests. */}
            <span className="hidden pointer-fine:inline"> Keys 1 to 4 work too.</span>
          </>
        )}
      </p>
      {players > 1 && (
        <p className="text-sm text-muted">
          {round.answeredIds.length} of {players} answered
        </p>
      )}
    </>
  );
  const slot = (
    <>
      <Listening status={clip} playing={!timeUp} />
      {timer}
    </>
  );
  return <Stage slot={slot} cards={cards} below={below} />;
}

function RoundView({ store, lobby, round, titleLanguage, isHost, clip }: RoundProps & { round: ClientRound }) {
  const { start, reveal } = round;
  const started = useReached(store.serverNow, start?.startsAt ?? null);
  const solo = lobby.players.length === 1;
  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="display text-2xl">
          Round {round.number} of {round.rounds}
        </h2>
        {isHost && !reveal && (
          <ConfirmButton
            label="Skip round"
            question={solo ? 'Skip this round?' : 'Skip this round for everyone?'}
            onConfirm={() => store.skipRound()}
          />
        )}
      </div>
      <p className="mt-1 text-sm text-muted">{scoringLine(lobby.settings.scoring)}</p>
      {reveal ? (
        <Reveal round={round} reveal={reveal} lobby={lobby} titleLanguage={titleLanguage} />
      ) : !start ? (
        <Stage
          slot={
            <>
              <Listening status={clip} playing={false} />
              <p aria-live="polite">Get ready…</p>
            </>
          }
          cards={<FaceDownCards />}
        />
      ) : !started ? (
        <Stage
          slot={
            <>
              <Listening status={clip} playing={false} />
              <Countdown store={store} startsAt={start.startsAt} />
            </>
          }
          cards={<FaceDownCards />}
        />
      ) : (
        <Answering store={store} lobby={lobby} round={round} start={start} titleLanguage={titleLanguage} clip={clip} />
      )}
    </Panel>
  );
}
