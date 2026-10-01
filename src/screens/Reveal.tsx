// The reveal (docs/product-specs/game-flow.md): this player's verdict and standing first, under the round's
// heading, then the four cards in their order, the right one turned over to its printed back and each with who
// picked it, then the answer in every language with its song, and the standings as a scoreboard with who
// moved. Right and wrong show with an icon and words, never color alone. The verdict lands like a stamp, and the right card with its theme's hit, which
// grows with this player's streak.
import type { LobbyState, RoundReveal, StandingView } from '../../shared/protocol.ts';
import type { TitleLanguage } from '../../shared/settings.ts';
import { OptionCard } from '../components/OptionCard.tsx';
import type { CardState } from '../components/OptionCard.tsx';
import { CheckIcon, CrossIcon } from '../components/ui.tsx';
import { aired, animeTitle, credits, langOf, otherTitles, place, points, score, sharedPlaces } from '../format.ts';
import type { Title } from '../format.ts';
import type { ClientRound } from '../realtime/game-state.ts';
import { useStage } from '../themes/stage.ts';

interface RevealProps {
  round: ClientRound;
  reveal: RoundReveal;
  lobby: LobbyState;
  titleLanguage: TitleLanguage;
}

interface Verdict {
  text: string;
  right: boolean | null; // null when the round had no right or wrong for this player
}

function nameOf(lobby: LobbyState, playerId: string): string {
  return lobby.players.find((player) => player.id === playerId)?.name ?? 'A player who left';
}

// A missed song, wrong or unanswered, earns the game's own line (docs/PRODUCT_SENSE.md#tone).
function verdictOf(reveal: RoundReveal, playerId: string): Verdict | null {
  if (reveal.skipped) return { text: 'The host skipped this round, so nobody scores.', right: null };
  const pick = reveal.picks.find((candidate) => candidate.playerId === playerId);
  if (!pick) return null;
  if (pick.option === reveal.correct) {
    // Only First correct gives a right answer nothing.
    return pick.points > 0
      ? { text: `Right: ${points(pick.points)}`, right: true }
      : { text: 'Right, but someone was faster.', right: true };
  }
  const missed = `You skipped the ${reveal.theme.kind}?!`;
  return { text: pick.points < 0 ? `${missed} ${points(pick.points)}` : missed, right: false };
}

function ranked(standings: StandingView[]): StandingView[] {
  return [...standings].sort((a, b) => b.score - a.score);
}

function placesOf(order: StandingView[]): number[] {
  return sharedPlaces(order.map((standing) => standing.score));
}

function streakOf(reveal: RoundReveal, playerId: string): number {
  return reveal.standings.find((standing) => standing.playerId === playerId)?.streak ?? 0;
}

// How hard the right card lands for this player: a plain hit, then harder from three and five in a row.
function heatOf(streak: number): number {
  if (streak >= 5) return 3;
  return streak >= 3 ? 2 : 1;
}

// Where this player stands after the round, so the verdict carries the score without a scroll.
function standingLine(reveal: RoundReveal, playerId: string): string | null {
  const order = ranked(reveal.standings);
  const rank = order.findIndex((standing) => standing.playerId === playerId);
  const mine = order[rank];
  if (!mine) return null;
  const total = `${score(mine.score)} points`;
  const standing = order.length > 1 ? `${place(placesOf(order)[rank] ?? rank + 1)} of ${order.length}` : null;
  return [standing, total].filter(Boolean).join(' · ');
}

// How long the answer's title reads, so a long one steps down in size instead of filling the band. A
// Japanese character is about two Latin letters wide.
function titleLength(title: Title): 'long' | 'mid' | undefined {
  const width = title.lang === 'ja' ? title.text.length * 2 : title.text.length;
  if (width > 40) return 'long';
  return width > 22 ? 'mid' : undefined;
}

function cardStateOf(index: number, reveal: RoundReveal, mine: number | null): CardState {
  if (index === reveal.correct) return 'right';
  return index === mine ? 'missed' : 'muted';
}

type Outcome = 'right' | 'wrong' | 'none';

function outcomeOf(reveal: RoundReveal, playerId: string): Outcome {
  const pick = reveal.picks.find((candidate) => candidate.playerId === playerId);
  if (!pick || pick.option === null) return 'none';
  return pick.option === reveal.correct ? 'right' : 'wrong';
}

function pointsOf(reveal: RoundReveal, playerId: string): number {
  return reveal.picks.find((candidate) => candidate.playerId === playerId)?.points ?? 0;
}

// Each player's rank before this round's points, so the board can show who moved up and who fell back.
function ranksBefore(reveal: RoundReveal, order: StandingView[]): Map<string, number> {
  const before = [...order].sort(
    (a, b) => b.score - pointsOf(reveal, b.playerId) - (a.score - pointsOf(reveal, a.playerId)),
  );
  return new Map(before.map((standing, rank) => [standing.playerId, rank]));
}

function MoveMark({ from, to }: { from: number; to: number }) {
  const move = from > to ? 'up' : from < to ? 'down' : 'same';
  return (
    <span className="board-move" data-move={move}>
      {move === 'same' ? (
        <svg aria-hidden="true" viewBox="0 0 14 14">
          <path d="M3 7 H11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ) : (
        <svg aria-hidden="true" viewBox="0 0 14 14" fill="currentColor">
          <path d={move === 'up' ? 'M7 2 L13 11 H1 Z' : 'M7 12 L13 3 H1 Z'} />
        </svg>
      )}
      <span className="sr-only">{move === 'same' ? 'same place' : `${move} ${Math.abs(from - to)}`}</span>
    </span>
  );
}

// Who picked this option, under its card, so everyone sees who fell for which. Picks reach the client only
// with the reveal, after the round has closed for everyone, so this can never show while anyone can still
// answer.
function Pickers({ reveal, lobby, option }: { reveal: RoundReveal; lobby: LobbyState; option: number }) {
  const pickers = reveal.picks.filter((pick) => pick.option === option);
  if (pickers.length === 0) return <span />;
  return (
    <p className="pickers">
      <span className="sr-only">Picked by </span>
      {pickers.map((pick, at) => (
        <span key={pick.playerId} className="picker" data-you={pick.playerId === lobby.you || undefined}>
          {nameOf(lobby, pick.playerId)}
          {at < pickers.length - 1 && <span className="sr-only">, </span>}
        </span>
      ))}
    </p>
  );
}

// The round's standings as a scoreboard: place, who moved, the name, what this round earned, and the total.
function Lineup({ reveal, lobby }: { reveal: RoundReveal; lobby: LobbyState }) {
  const order = ranked(reveal.standings);
  const places = placesOf(order);
  const before = ranksBefore(reveal, order);
  return (
    <ol aria-label="Scores" className="board">
      {order.map((standing, rank) => {
        const outcome = outcomeOf(reveal, standing.playerId);
        const gained = pointsOf(reveal, standing.playerId);
        const pick = reveal.picks.find((candidate) => candidate.playerId === standing.playerId);
        return (
          <li key={standing.playerId} className="board-row" data-you={standing.playerId === lobby.you || undefined}>
            <span className="board-place">{place(places[rank] ?? rank + 1)}</span>
            <MoveMark from={before.get(standing.playerId) ?? rank} to={rank} />
            <span className="board-name">
              {nameOf(lobby, standing.playerId)}
              {standing.playerId === lobby.you && <span className="ml-2 text-xs text-muted">you</span>}
              {pick?.noAudio && <span className="ml-2 text-xs text-muted">no audio</span>}
            </span>
            <span className="board-delta" data-outcome={outcome}>
              {outcome === 'none' ? (
                'no answer'
              ) : (
                <>
                  {outcome === 'right' ? <CheckIcon /> : <CrossIcon />} {gained !== 0 ? points(gained) : outcome}
                </>
              )}
            </span>
            <span className="board-total">{score(standing.score)}</span>
          </li>
        );
      })}
    </ol>
  );
}

function VerdictLine({ verdict, standing, streak }: { verdict: Verdict; standing: string | null; streak: number }) {
  const mood = verdict.right === true ? 'right' : verdict.right === false ? 'wrong' : 'none';
  return (
    <div>
      <p
        aria-live="polite"
        className="verdict display flex items-center gap-3 text-3xl leading-tight"
        data-verdict={mood}
      >
        {verdict.right !== null && (
          <span className="verdict-badge">{verdict.right ? <CheckIcon /> : <CrossIcon />}</span>
        )}
        <span className="verdict-words">{verdict.text}</span>
      </p>
      <p className="motion-rise mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
        {standing}
        {streak >= 2 && (
          <span className="streak-chip" data-hot={streak >= 3 || undefined}>
            {streak} in a row
          </span>
        )}
      </p>
    </div>
  );
}

export function Reveal({ round, reveal, lobby, titleLanguage }: RevealProps) {
  const title = animeTitle(reveal.anime, titleLanguage);
  const when = aired(reveal.season, reveal.year);
  const options = round.start?.options[titleLanguage] ?? [];
  const mine = reveal.picks.find((pick) => pick.playerId === lobby.you)?.option ?? round.choice;
  const verdict = verdictOf(reveal, lobby.you);
  const standing = standingLine(reveal, lobby.you);
  const streak = streakOf(reveal, lobby.you);
  const heat = mine === reveal.correct ? heatOf(streak) : 1;
  const { wrongMark } = useStage();

  const slot = verdict ? (
    <VerdictLine verdict={verdict} standing={standing} streak={streak} />
  ) : (
    standing && <p className="motion-rise text-sm text-muted">{standing}</p>
  );
  const back = (
    <>
      <span className="card-back-label">
        <CheckIcon />
        {mine === reveal.correct ? 'Right answer, your pick' : 'Right answer'}
      </span>
      <span className="card-back-title" lang={title.lang}>
        {options[reveal.correct] ?? title.text}
      </span>
      <span className="card-back-meta">
        {[`${reveal.theme.kind} ${reveal.theme.sequence}`, reveal.year].filter(Boolean).join(' · ')}
      </span>
    </>
  );
  const cards = (
    <ol aria-label="Options" className="options options-picked grid grid-cols-2 gap-3">
      {options.map((optionTitle, index) => (
        <li key={index}>
          <OptionCard
            index={index}
            title={optionTitle}
            lang={langOf(titleLanguage)}
            state={cardStateOf(index, reveal, mine)}
            tag={
              index === mine && index !== reveal.correct ? (
                <>
                  <CrossIcon /> Your pick
                </>
              ) : undefined
            }
            mark={index === reveal.correct ? undefined : (wrongMark ?? undefined)}
            back={index === reveal.correct ? back : undefined}
            heat={heat}
          />
          <Pickers reveal={reveal} lobby={lobby} option={index} />
        </li>
      ))}
    </ol>
  );
  const below = (
    <section aria-labelledby="reveal-heading" className="motion-rise reveal-answer mt-5 flex flex-col gap-5">
      <h3 id="reveal-heading" className="sr-only">
        The answer
      </h3>
      <div className="reveal-band">
        {reveal.cover && <img src={reveal.cover} alt="" className="reveal-wash" />}
        {reveal.cover && <img src={reveal.cover} alt="" className="reveal-cover" />}
        <div className="reveal-titles">
          <p lang={title.lang} className="display reveal-title" data-length={titleLength(title)}>
            {title.text}
          </p>
          {otherTitles(reveal.anime, title).map((other) => (
            <p key={other.text} lang={other.lang} className="text-muted [overflow-wrap:anywhere]">
              {other.text}
            </p>
          ))}
          <p className="reveal-song">
            <span className="reveal-kind">
              {reveal.theme.kind} {reveal.theme.sequence}
            </span>
            {reveal.song.title && <span className="font-semibold">{reveal.song.title}</span>}
            {reveal.song.artists.length > 0 && <span className="text-muted">by {credits(reveal.song.artists)}</span>}
            {when && <span className="text-muted">{when}</span>}
          </p>
        </div>
      </div>
      <Lineup reveal={reveal} lobby={lobby} />
      <p className="text-sm text-muted">
        {round.number === round.rounds ? 'The results come next.' : 'The next round starts in a few seconds.'}
      </p>
    </section>
  );
  return (
    <>
      <div className="flex flex-col gap-4 pt-4">
        {slot}
        {cards}
      </div>
      {below}
    </>
  );
}
