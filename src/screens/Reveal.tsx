// The reveal teaches the answer (docs/product-specs/game-flow.md): the anime in every language, OP or ED
// and its number, the song and its artists, when it aired, the cover, and what everyone picked and scored.
// Right and wrong show with an icon and words, never color alone.
import type { LobbyState, RoundReveal } from '../../shared/protocol.ts';
import type { TitleLanguage } from '../../shared/settings.ts';
import { CheckIcon, CrossIcon } from '../components/ui.tsx';
import { aired, animeTitle, credits, langOf, otherTitles, points, score } from '../format.ts';
import type { ClientRound } from '../realtime/game-state.ts';

interface RevealProps {
  round: ClientRound;
  reveal: RoundReveal;
  lobby: LobbyState;
  titleLanguage: TitleLanguage;
}

function nameOf(lobby: LobbyState, playerId: string): string {
  return lobby.players.find((player) => player.id === playerId)?.name ?? 'A player who left';
}

function verdict(reveal: RoundReveal, playerId: string): string | null {
  if (reveal.skipped) return 'The host skipped this round, so nobody scores.';
  const pick = reveal.picks.find((candidate) => candidate.playerId === playerId);
  if (!pick) return null;
  if (pick.option === null) return 'No answer this time.';
  if (pick.option === reveal.correct) {
    // Only First correct gives a right answer nothing.
    return pick.points > 0 ? `Right: ${points(pick.points)}` : 'Right, but someone was faster.';
  }
  return pick.points < 0 ? `Wrong: ${points(pick.points)}` : 'Wrong.';
}

export function Reveal({ round, reveal, lobby, titleLanguage }: RevealProps) {
  const title = animeTitle(reveal.anime, titleLanguage);
  const song = [`${reveal.theme.kind} ${reveal.theme.sequence}`, reveal.song.title].filter(Boolean).join(': ');
  const when = aired(reveal.season, reveal.year);
  const options = round.start?.options[titleLanguage] ?? [];
  const mine = reveal.picks.find((pick) => pick.playerId === lobby.you)?.option ?? round.choice;
  const standings = [...reveal.standings].sort((a, b) => b.score - a.score);
  const summary = verdict(reveal, lobby.you);

  return (
    <section aria-labelledby="reveal-heading" className="flex flex-col gap-5">
      <div className="flex gap-4">
        {reveal.cover && <img src={reveal.cover} alt="" className="h-36 w-24 shrink-0 rounded-lg object-cover" />}
        <div className="flex min-w-0 flex-col gap-1">
          <h3 id="reveal-heading" className="text-muted">
            {reveal.skipped ? 'Skipped' : 'The answer'}
          </h3>
          <p lang={title.lang} className="text-2xl font-bold">
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

      {summary && (
        <p aria-live="polite" className="text-lg font-semibold">
          {summary}
        </p>
      )}

      <ol aria-label="Options" className="grid gap-2 sm:grid-cols-2">
        {options.map((optionTitle, index) => {
          const right = index === reveal.correct;
          const picked = index === mine;
          const tone = right ? 'border-good' : picked ? 'border-bad' : 'border-line';
          return (
            <li key={index} className={`flex items-center gap-2 rounded-xl border-2 p-3 ${tone}`}>
              {right ? <CheckIcon /> : picked ? <CrossIcon /> : <span className="size-5 shrink-0" />}
              <span lang={langOf(titleLanguage)} className="flex-1">
                {optionTitle}
              </span>
              <span className="text-sm text-muted">
                {[right && 'right answer', picked && 'your pick'].filter(Boolean).join(', ')}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <caption className="sr-only">Scores after this round</caption>
          <thead className="text-sm text-muted">
            <tr>
              <th scope="col" className="py-1 pr-3 font-medium">
                Player
              </th>
              <th scope="col" className="py-1 pr-3 font-medium">
                This round
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {standings.map((standing) => {
              const pick = reveal.picks.find((candidate) => candidate.playerId === standing.playerId);
              const right = pick?.option === reveal.correct;
              return (
                <tr key={standing.playerId} className="border-t border-line">
                  <td className="py-2 pr-3">
                    {nameOf(lobby, standing.playerId)}
                    {standing.streak >= 2 && (
                      <span className="ml-2 text-sm text-muted">{standing.streak} in a row</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <span className="inline-flex items-center gap-1">
                      {pick?.option === null || !pick ? (
                        'No answer'
                      ) : (
                        <>
                          {right ? <CheckIcon /> : <CrossIcon />}
                          {right ? 'Right' : 'Wrong'}
                        </>
                      )}
                      {pick && pick.points !== 0 && <span className="tabular-nums">{points(pick.points)}</span>}
                      {pick?.noAudio && <span className="text-xs text-muted">no audio</span>}
                    </span>
                  </td>
                  <td className="py-2 text-right tabular-nums">{score(standing.score)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted">
        {round.number === round.rounds ? 'The results come next.' : 'The next round starts in a few seconds.'}
      </p>
    </section>
  );
}
