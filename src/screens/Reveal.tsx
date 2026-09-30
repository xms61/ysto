// The reveal (docs/product-specs/game-flow.md): this player's verdict and standing first, under the round's
// heading, then the four cards in their order, the right one turned over to its printed back, then the answer
// in every language with its song, and the standings billed like a lineup. Right and wrong show with an icon and words, never color alone.
import type { LobbyState, RoundReveal, StandingView } from '../../shared/protocol.ts';
import type { TitleLanguage } from '../../shared/settings.ts';
import { OptionCard } from '../components/OptionCard.tsx';
import type { CardState } from '../components/OptionCard.tsx';
import { CheckIcon, CrossIcon } from '../components/ui.tsx';
import { aired, animeTitle, credits, langOf, otherTitles, place, points, score } from '../format.ts';
import type { ClientRound } from '../realtime/game-state.ts';

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

// Where this player stands after the round, so the verdict carries the score without a scroll.
function standingLine(reveal: RoundReveal, playerId: string): string | null {
  const order = ranked(reveal.standings);
  const rank = order.findIndex((standing) => standing.playerId === playerId);
  const mine = order[rank];
  if (!mine) return null;
  const total = `${score(mine.score)} points`;
  const streak = mine.streak >= 2 ? `${mine.streak} in a row` : null;
  const standing = order.length > 1 ? `${place(rank + 1)} of ${order.length}` : null;
  return [standing, total, streak].filter(Boolean).join(' · ');
}

function cardStateOf(index: number, reveal: RoundReveal, mine: number | null): CardState {
  if (index === reveal.correct) return 'right';
  return index === mine ? 'missed' : 'muted';
}

function Lineup({ reveal, lobby }: { reveal: RoundReveal; lobby: LobbyState }) {
  const size = (rank: number) =>
    rank === 0 ? 'display text-2xl' : rank < 3 ? 'text-lg font-semibold' : 'font-semibold';
  return (
    <ol aria-label="Scores" className="border-t border-line pt-2">
      {ranked(reveal.standings).map((standing, rank) => {
        const pick = reveal.picks.find((candidate) => candidate.playerId === standing.playerId);
        const answered = pick !== undefined && pick.option !== null;
        const right = answered && pick.option === reveal.correct;
        return (
          <li key={standing.playerId} className="bill-row">
            <span className="bill-place">{place(rank + 1)}</span>
            <span className="bill-who flex flex-wrap items-baseline gap-x-2">
              <span className={`[overflow-wrap:anywhere] ${size(rank)}`}>{nameOf(lobby, standing.playerId)}</span>
              {standing.playerId === lobby.you && (
                <span className="rounded-full border border-line px-2 text-xs text-muted">you</span>
              )}
              <span className="inline-flex items-center gap-1 text-sm whitespace-nowrap">
                {!answered ? (
                  'no answer'
                ) : right ? (
                  <>
                    <CheckIcon /> right
                  </>
                ) : (
                  <>
                    <CrossIcon /> wrong
                  </>
                )}
                {pick && pick.points !== 0 && <span className="tabular-nums">{points(pick.points)}</span>}
              </span>
              {pick?.noAudio && <span className="text-xs text-muted">no audio</span>}
            </span>
            <span className={`bill-score ${rank === 0 ? 'display text-2xl' : ''}`}>{score(standing.score)}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function Reveal({ round, reveal, lobby, titleLanguage }: RevealProps) {
  const title = animeTitle(reveal.anime, titleLanguage);
  const song = [`${reveal.theme.kind} ${reveal.theme.sequence}`, reveal.song.title].filter(Boolean).join(': ');
  const when = aired(reveal.season, reveal.year);
  const options = round.start?.options[titleLanguage] ?? [];
  const mine = reveal.picks.find((pick) => pick.playerId === lobby.you)?.option ?? round.choice;
  const verdict = verdictOf(reveal, lobby.you);
  const standing = standingLine(reveal, lobby.you);

  const slot = (
    <div className="motion-rise">
      {verdict && (
        <p aria-live="polite" className="display flex items-center gap-2 text-3xl leading-tight">
          {verdict.right === true && <CheckIcon />}
          {verdict.right === false && <CrossIcon />}
          {verdict.text}
        </p>
      )}
      {standing && <p className="mt-1 text-sm text-muted">{standing}</p>}
    </div>
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
    <ol aria-label="Options" className="grid grid-cols-2 gap-3">
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
            back={index === reveal.correct ? back : undefined}
          />
        </li>
      ))}
    </ol>
  );
  const below = (
    <section aria-labelledby="reveal-heading" className="motion-rise mt-5 flex flex-col gap-5">
      <h3 id="reveal-heading" className="sr-only">
        The answer
      </h3>
      <div className="flex gap-4 border-t border-line pt-4">
        {reveal.cover && <img src={reveal.cover} alt="" className="h-36 w-24 shrink-0 rounded-lg object-cover" />}
        <div className="flex min-w-0 flex-col gap-1">
          <p lang={title.lang} className="display text-2xl">
            {title.text}
          </p>
          {otherTitles(reveal.anime, title).map((other) => (
            <p key={other.text} lang={other.lang} className="text-muted">
              {other.text}
            </p>
          ))}
          <p className="mt-1">{song}</p>
          {reveal.song.artists.length > 0 && <p className="text-muted">by {credits(reveal.song.artists)}</p>}
          {when && <p className="text-muted">{when}</p>}
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
