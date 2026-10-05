// A round from the player's side (docs/product-specs/game-flow.md): four cards dealt face down while the clip
// loads and the countdown runs, turned face up together exactly when the clip starts, then the reveal. Keys 1
// to 4 answer too. With answer changes on, the cards stay open after a pick, and once everyone has answered
// an overtime counts down before the reveal.
import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { LobbyState } from '../../shared/protocol.ts';
import { POINTS } from '../../shared/scoring.ts';
import { answersCanChange } from '../../shared/settings.ts';
import type { LobbySettings } from '../../shared/settings.ts';
import { Listening } from '../components/Listening.tsx';
import { PlayerBadge } from '../components/PlayerIcon.tsx';
import { ReactionBar } from '../components/Reactions.tsx';
import { ReportClip } from '../components/ReportClip.tsx';
import { FaceDownCards, OptionCard } from '../components/OptionCard.tsx';
import type { CardState } from '../components/OptionCard.tsx';
import { MODE_LABELS } from '../components/SettingsForm.tsx';
import { Candle } from '../components/Candle.tsx';
import { Cassette } from '../components/Cassette.tsx';
import { Dango } from '../components/Dango.tsx';
import { Route } from '../components/Route.tsx';
import { Ruler } from '../components/Ruler.tsx';
import { Shide } from '../components/Shide.tsx';
import { Dial } from '../components/Dial.tsx';
import { FocusLines } from '../components/FocusLines.tsx';
import { Nipper } from '../components/Nipper.tsx';
import { Pennants } from '../components/Pennants.tsx';
import { Segments } from '../components/Segments.tsx';
import { RoundBody, Stage } from '../components/Stage.tsx';
import { ConfirmButton, Panel } from '../components/ui.tsx';
import { optionTitle, score } from '../format.ts';
import type { TitleLanguages } from '../format.ts';
import { motionAllowed, usePagePhase, useReached, useTicker } from '../hooks.ts';
import type { ClientRound, RoundStart } from '../realtime/game-state.ts';
import type { ClipStatus, GameStore } from '../realtime/store.ts';
import { useOptionColumns, useStage } from '../themes/stage.ts';
import { Reveal } from './Reveal.tsx';

const TICK_MS = 250;
const OPTION_KEYS = ['1', '2', '3', '4'];
const LOCK_IN_BUZZ_MS = 12;

// Locking in answers with a short buzz where the device has one, as it stamps the card. It follows the motion
// setting, since a player who turned motion off asked for a quieter game.
function answer(store: GameStore, option: number): void {
  store.answer(option);
  if (motionAllowed() && 'vibrate' in navigator) navigator.vibrate(LOCK_IN_BUZZ_MS);
}

interface RoundProps {
  store: GameStore;
  lobby: LobbyState;
  round: ClientRound | null;
  titles: TitleLanguages;
  reported: number[]; // the rounds whose clip this player reported
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
      if (option >= 0) answer(store, option);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store, active]);
}

// What a round is worth, stated where the answer is given: a wrong answer can cost points, and an answer may
// be changed.
function scoringLine(settings: LobbySettings): string {
  const rules = settings.scoring;
  const penalty = rules.mode === 'firstCorrect' ? POINTS.firstCorrectPenalty : POINTS.penalty;
  return [
    MODE_LABELS[rules.mode],
    rules.streakBonus && 'streak bonus',
    rules.comeback && 'comeback',
    rules.wrongAnswerPenalty && `wrong answers cost ${penalty}`,
    answersCanChange(settings) && 'answers can change',
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
// starts from a time read before the round's start was known. Screen readers hear "Get ready" once, not
// every second.
function Countdown({ store, startsAt }: { store: GameStore; startsAt: number }) {
  const now = useTicker(store.serverNow, TICK_MS);
  return <CountdownFace seconds={Math.max(1, Math.ceil((startsAt - now) / 1000))} />;
}

// The countdown's digits, with "Get ready" beside them unless it's the stage's hidden copy, which only needs
// their height.
function CountdownFace({ seconds, labelled = true }: { seconds: number; labelled?: boolean }) {
  const { readout } = useStage();
  return (
    <p className="flex items-baseline gap-4">
      {labelled && (
        <span aria-live="polite" className="text-muted">
          Get ready
        </span>
      )}
      {readout === 'segments' ? (
        <span className="readout countdown-readout">
          <Segments value={seconds} digits={2} />
        </span>
      ) : (
        <span aria-hidden="true" key={seconds} className="display countdown-number motion-tick text-6xl tabular-nums">
          {seconds}
        </span>
      )}
    </p>
  );
}

// The time left in the theme's own form: a seven-segment display of the seconds, a dango skewer eaten down, a
// nipper cutting along a runner, a coin dial turning, a candle burning down, a printer's ruler, a shrine rope's paper
// streamers, a walk on a park map, the referee's pennants, a manga panel's focus lines or a cassette's reels, with the
// seconds beside it, or huge arcade digits. Where the heading is sung as a lyric line, that line is the timer and only
// the seconds show here.
function TimeLeft({ elapsed, secondsLeft }: { elapsed: number; secondsLeft: number }) {
  const { readout } = useStage();
  if (readout === 'segments') {
    return (
      <p className="readout self-start">
        <Segments value={secondsLeft} digits={2} />
        <span className="readout-unit">s left</span>
        <span className="sr-only">{secondsLeft} seconds left</span>
      </p>
    );
  }
  if (readout === 'digits') {
    return (
      <p className="arcade-timer" data-low={secondsLeft <= 5 || undefined}>
        <span aria-hidden="true" key={secondsLeft} className="motion-tick inline-block">
          {String(secondsLeft).padStart(2, '0')}
        </span>
        <span className="sr-only">{secondsLeft} seconds left</span>
      </p>
    );
  }
  if (readout === 'dango') {
    return (
      <div className="flex items-center gap-3">
        <Dango left={1 - elapsed} />
        <p className="ml-auto tabular-nums">{secondsLeft} s left</p>
      </div>
    );
  }
  if (readout === 'lyric') {
    return <p className="lyric-left tabular-nums">{secondsLeft} s left</p>;
  }
  if (readout === 'reels') {
    return (
      <div className="flex items-center gap-3">
        <Cassette left={1 - elapsed} />
        <p className="tabular-nums">{secondsLeft} s left</p>
      </div>
    );
  }
  if (readout === 'focus') {
    return (
      <div className="flex items-center gap-3">
        <FocusLines left={1 - elapsed} />
        <p className="tabular-nums">{secondsLeft} s left</p>
      </div>
    );
  }
  if (readout === 'pennants') {
    return (
      <div className="flex items-center gap-3">
        <Pennants left={1 - elapsed} />
        <p className="tabular-nums">{secondsLeft} s left</p>
      </div>
    );
  }
  if (readout === 'route') {
    return (
      <div className="flex items-center gap-3">
        <Route left={1 - elapsed} />
        <p className="tabular-nums">{secondsLeft} s left</p>
      </div>
    );
  }
  if (readout === 'shide') {
    return (
      <div className="flex items-center gap-3">
        <Shide left={1 - elapsed} />
        <p className="tabular-nums">{secondsLeft} s left</p>
      </div>
    );
  }
  if (readout === 'ruler') {
    return (
      <div className="flex items-center gap-3">
        <Ruler left={1 - elapsed} />
        <p className="tabular-nums">{secondsLeft} s left</p>
      </div>
    );
  }
  if (readout === 'candle') {
    return (
      <div className="flex items-end gap-3">
        <Candle left={1 - elapsed} />
        <p className="tabular-nums">{secondsLeft} s left</p>
      </div>
    );
  }
  if (readout === 'dial') {
    return (
      <div className="flex items-center gap-3">
        <Dial left={1 - elapsed} />
        <p className="tabular-nums">{secondsLeft} s left</p>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <Nipper left={1 - elapsed} />
      <p className="ml-auto tabular-nums">{secondsLeft} s left</p>
    </div>
  );
}

interface AnsweringProps {
  store: GameStore;
  lobby: LobbyState;
  round: ClientRound;
  start: RoundStart;
  titles: TitleLanguages;
  clip: ClipStatus | null;
}

function cardState(round: ClientRound, open: boolean, index: number): CardState {
  if (round.choice === index) return 'chosen';
  return open ? 'open' : 'muted';
}

const NUDGE_MS = 2500;

// "Mio switched", for a moment after each switch. Who, never to what.
function Nudge({ lobby, nudge }: { lobby: LobbyState; nudge: ClientRound['nudge'] }) {
  const [faded, setFaded] = useState(0);
  useEffect(() => {
    if (!nudge) return;
    const timer = setTimeout(() => setFaded(nudge.count), NUDGE_MS);
    return () => clearTimeout(timer);
  }, [nudge]);
  const name = lobby.players.find((player) => player.id === nudge?.playerId)?.name;
  return (
    <p aria-live="polite" className="nudge-line">
      {nudge && faded !== nudge.count && name && (
        <span key={nudge.count} className="nudge">
          {name} switched
        </span>
      )}
    </p>
  );
}

// The overtime's call above the time left: the round stays open a few seconds more, for a last switch.
function OvertimeCall({ secondsLeft }: { secondsLeft: number }) {
  return (
    <p className="overtime-call" role="status">
      <span className="display overtime-word">Overtime</span>
      <span className="overtime-hint">Last chance to switch</span>
      <span className="sr-only">, {secondsLeft} seconds</span>
    </p>
  );
}

function statusLine(spectating: boolean, answered: boolean, canSwitch: boolean, closed: boolean, overtime: boolean) {
  if (spectating) return "You joined during this round. You'll play from the next one.";
  if (closed) return answered ? 'Locked in.' : "Time's up.";
  if (overtime) return answered ? 'Everyone has answered. Keep your pick, or switch now.' : 'Pick the anime, quick.';
  if (answered && canSwitch) return 'Locked in for now. Tap another card to switch.';
  if (answered) return 'Locked in. Waiting for the others.';
  return null;
}

function Answering({ store, lobby, round, start, titles, clip, ghost }: AnsweringProps & { ghost: ReactNode }) {
  const now = useTicker(store.serverNow, TICK_MS);
  const spectating = lobby.players.find((player) => player.id === lobby.you)?.spectating ?? false;
  const answered = round.choice !== null || round.answeredIds.includes(lobby.you);
  const canSwitch = answersCanChange(lobby.settings);
  const { overtime } = round;
  const countdown = overtime ?? start;
  const closed = now >= countdown.endsAt;
  const canAnswer = !spectating && !closed && (!answered || canSwitch);
  useAnswerKeys(store, canAnswer);
  const elapsed = Math.min(1, Math.max(0, (now - countdown.startsAt) / (countdown.endsAt - countdown.startsAt)));
  const secondsLeft = Math.max(0, Math.ceil((countdown.endsAt - now) / 1000));
  const players = lobby.players.filter((player) => !player.spectating).length;

  const columns = useOptionColumns();
  const timer = <TimeLeft elapsed={elapsed} secondsLeft={secondsLeft} />;
  const cards = (
    <ol aria-label="Options" className={`options grid ${columns} gap-3`}>
      {start.options[titles.first].map((_, index) => (
        <li key={index}>
          <OptionCard
            index={index}
            title={optionTitle(start.options, index, titles)}
            state={cardState(round, canAnswer, index)}
            tag={round.choice === index ? 'Your pick' : undefined}
            dealt
            disabled={!canAnswer || round.choice === index}
            onPick={() => answer(store, index)}
          />
        </li>
      ))}
    </ol>
  );
  const status = statusLine(spectating, answered, canSwitch, closed, overtime !== null);
  const below = (
    <>
      <p aria-live="polite" className="text-muted">
        {status ?? (
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
      {canSwitch && players > 1 && <Nudge lobby={lobby} nudge={round.nudge} />}
    </>
  );
  const slot = (
    <>
      <Listening status={clip} playing={now < start.endsAt} />
      {overtime && !closed && <OvertimeCall secondsLeft={secondsLeft} />}
      <div className="time-left" data-overtime={overtime ? '' : undefined}>
        {timer}
      </div>
    </>
  );
  return (
    <RoundBody
      main={<Stage slot={slot} ghost={ghost} cards={cards} below={below} />}
      side={<LiveScores lobby={lobby} round={round} />}
    />
  );
}

// The slot at its tallest, for the stage to hold that height in every phase, so the cards never move: the
// countdown, and the answering slot with the overtime's call when answers can change, laid over each other.
function TimerGhost({ lobby, clip }: { lobby: LobbyState; clip: ClipStatus | null }) {
  return (
    <div className="grid items-end">
      <div className="flex flex-col justify-end gap-4 [grid-area:1/1]">
        <Listening status={clip} playing={false} />
        <CountdownFace seconds={3} labelled={false} />
      </div>
      <div className="flex flex-col justify-end gap-4 [grid-area:1/1]">
        <Listening status={clip} playing={false} />
        {answersCanChange(lobby.settings) && <OvertimeCall secondsLeft={0} />}
        <div className="time-left">
          <TimeLeft elapsed={0} secondsLeft={20} />
        </div>
      </div>
    </div>
  );
}

// The side column while the round runs: everyone's score so far, and who has answered once the options are
// out. Who picked what stays hidden until the reveal.
function LiveScores({ lobby, round }: { lobby: LobbyState; round: ClientRound }) {
  const players = lobby.players.filter((player) => !player.spectating).sort((a, b) => b.score - a.score);
  return (
    <section aria-labelledby="live-scores" className="side-scores">
      <h3 id="live-scores" className="side-heading">
        Scores
      </h3>
      <ol className="board">
        {players.map((player) => {
          const answered = round.start !== null && round.answeredIds.includes(player.id);
          return (
            <li
              key={player.id}
              className="live-row"
              data-player={player.id}
              data-you={player.id === lobby.you || undefined}
            >
              <span className="board-name">
                <PlayerBadge icon={player.icon} />
                {player.name}
              </span>
              <span className="live-state" data-answered={answered || undefined}>
                {round.start && (answered ? 'answered' : 'thinking')}
              </span>
              <span className="board-total">{score(player.score)}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

interface RoundHeadingProps {
  number: number;
  rounds: number;
  store: GameStore;
  start: RoundStart | null;
  revealed: boolean;
}

// The round's heading: "Round 3 of 15", a magazine's masthead number, "No. 03 / 15", which screen readers
// still hear as the round, or a lyric line sung as the round runs.
function RoundHeading(props: RoundHeadingProps) {
  const { number, rounds } = props;
  const { masthead, readout } = useStage();
  if (readout === 'lyric') return <LyricHeading {...props} />;
  if (!masthead) {
    return (
      <h2 className="display text-[1.375rem] sm:text-2xl">
        Round {number} of {rounds}
      </h2>
    );
  }
  const issue = (value: number) => String(value).padStart(2, '0');
  return (
    <h2 className="display">
      <span className="sr-only">
        Round {number} of {rounds}
      </span>
      <span aria-hidden="true" className="masthead">
        <span className="masthead-no">No.</span>
        <span className="masthead-issue">{issue(number)}</span>
        <span className="masthead-of">/ {issue(rounds)}</span>
      </span>
    </h2>
  );
}

// Karaoke Box's heading, sung like a lyric line on the booth's screen: the words fill with color from the left as
// the round runs, empty before it starts and full at the reveal. The filled copy is decoration.
function LyricHeading({ number, rounds, store, start, revealed }: RoundHeadingProps) {
  const now = useTicker(store.serverNow, TICK_MS);
  const running = start ? (now - start.startsAt) / (start.endsAt - start.startsAt) : 0;
  const sung = revealed ? 1 : Math.min(1, Math.max(0, running));
  const words = `Round ${number} of ${rounds}`;
  return (
    <h2 className="display lyric" style={{ '--sung': sung } as CSSProperties}>
      {words}
      <span aria-hidden="true" className="lyric-sung">
        {words}
      </span>
    </h2>
  );
}

function RoundView({ store, lobby, round, titles, reported, isHost, clip }: RoundProps & { round: ClientRound }) {
  const { start, reveal } = round;
  const started = useReached(store.serverNow, start?.startsAt ?? null);
  const solo = lobby.players.length === 1;
  usePagePhase(reveal ? 'reveal' : started ? 'playing' : 'countdown');
  const ghost = <TimerGhost lobby={lobby} clip={clip} />;
  return (
    <Panel className="round-panel">
      <div className="round-head flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <RoundHeading
          number={round.number}
          rounds={round.rounds}
          store={store}
          start={start}
          revealed={reveal !== null}
        />
        {/* Kept in place but hidden at the reveal, so the heading keeps its height and the cards their place. */}
        {isHost && (
          <div className={reveal ? 'invisible' : undefined}>
            <ConfirmButton
              label="Skip round"
              question={solo ? 'Skip this round?' : 'Skip this round for everyone?'}
              onConfirm={() => store.skipRound()}
            />
          </div>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">{scoringLine(lobby.settings)}</p>
      {reveal ? (
        <Reveal
          round={round}
          reveal={reveal}
          lobby={lobby}
          titles={titles}
          ghost={ghost}
          actions={
            <>
              <ReactionBar store={store} />
              <ReportClip store={store} number={round.number} reported={reported.includes(round.number)} />
            </>
          }
        />
      ) : !start || !started ? (
        <RoundBody
          main={
            <Stage
              slot={
                <>
                  <Listening status={clip} playing={false} />
                  {start ? <Countdown store={store} startsAt={start.startsAt} /> : <p aria-live="polite">Get ready…</p>}
                </>
              }
              ghost={ghost}
              cards={<FaceDownCards />}
            />
          }
          side={<LiveScores lobby={lobby} round={round} />}
        />
      ) : (
        <Answering store={store} lobby={lobby} round={round} start={start} titles={titles} clip={clip} ghost={ghost} />
      )}
    </Panel>
  );
}
