// Teams (docs/product-specs/game-flow.md): the lobby's teams with their members, where each player picks a team and
// the host can move anyone or shuffle everyone evenly; and a team's mark and name wherever teams are billed.
import type { LobbyState, ResultView, TeamStanding } from '../../shared/protocol.ts';
import type { GameStore } from '../realtime/store.ts';
import { place, points, score, sharedPlaces } from '../format.ts';
import { INPUT, buttonClass } from './ui.tsx';

export const TEAM_NAMES = ['Kitsune', 'Tanuki', 'Tengu', 'Kappa'] as const;

export function teamName(team: number): string {
  return TEAM_NAMES[team] ?? `Team ${team + 1}`;
}

// The team's mark: a dot in one of the world's own colors, decoration beside the name that says the team.
export function TeamName({ team }: { team: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className="team-dot" data-team={team} />
      {teamName(team)}
    </span>
  );
}

function TeamSelect({
  store,
  lobby,
  playerId,
  team,
}: {
  store: GameStore;
  lobby: LobbyState;
  playerId: string;
  team: number;
}) {
  const name = lobby.players.find((player) => player.id === playerId)?.name ?? '';
  return (
    <select
      aria-label={playerId === lobby.you ? 'Your team' : `${name}'s team`}
      className={`${INPUT} w-auto py-1`}
      value={team}
      onChange={(event) => store.setTeam(playerId, Number(event.target.value))}
    >
      {Array.from({ length: lobby.settings.teams }, (_, index) => (
        <option key={index} value={index}>
          {teamName(index)}
        </option>
      ))}
    </select>
  );
}

export function LobbyTeams({ store, lobby, isHost }: { store: GameStore; lobby: LobbyState; isHost: boolean }) {
  const teams = Array.from({ length: lobby.settings.teams }, (_, team) => team);
  return (
    <section aria-label="Teams" className="mt-4 flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {teams.map((team) => {
          const members = lobby.players.filter((player) => player.team === team);
          return (
            <div key={team} className="team-box">
              <h3 className="display">
                <TeamName team={team} /> <span className="text-sm text-muted">({members.length})</span>
              </h3>
              <ul className="mt-2 flex flex-col gap-1.5">
                {members.map((player) => (
                  <li key={player.id} className="flex items-center justify-between gap-2">
                    <span>{player.name}</span>
                    {(isHost || player.id === lobby.you) && (
                      <TeamSelect store={store} lobby={lobby} playerId={player.id} team={team} />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      {isHost && (
        <button type="button" className={`${buttonClass('quiet')} self-start`} onClick={() => store.shuffleTeams()}>
          Shuffle the teams
        </button>
      )}
    </section>
  );
}

// The teams' totals, best first, as the round's scores column and the reveal show them; with this round's points
// when there are any.
export function TeamBoard({ teams, label }: { teams: TeamStanding[]; label: string }) {
  const ranked = [...teams].sort((a, b) => b.score - a.score);
  return (
    <ol aria-label={label} className="team-board">
      {ranked.map((standing) => (
        <li key={standing.team} className="team-row">
          <TeamName team={standing.team} />
          {standing.points !== 0 && <span className="text-sm text-muted">{points(standing.points)}</span>}
          <span className="board-total">{score(standing.score)}</span>
        </li>
      ))}
    </ol>
  );
}

// The teams at the results, billed above the players: place, the team and its total, and under it each member
// with their own points.
export function TeamResults({
  lobby,
  teams,
  results,
}: {
  lobby: LobbyState;
  teams: TeamStanding[];
  results: ResultView[];
}) {
  const ranked = [...teams].sort((a, b) => b.score - a.score);
  const places = sharedPlaces(ranked.map((standing) => standing.score));
  return (
    <ol aria-label="Teams' standings" className="team-results">
      {ranked.map((standing, rank) => (
        <li key={standing.team} className="team-result" data-lead={rank === 0 || undefined}>
          <span className="flex items-baseline gap-3">
            <span className="bill-place">{place(places[rank] ?? rank + 1)}</span>
            <span className="display text-xl">
              <TeamName team={standing.team} />
            </span>
            <span className="ml-auto text-xl tabular-nums">{score(standing.score)}</span>
          </span>
          <span className="text-sm text-muted">
            {results
              .filter((result) => lobby.players.find((player) => player.id === result.playerId)?.team === standing.team)
              .map((result) => {
                const name = lobby.players.find((player) => player.id === result.playerId)?.name ?? '';
                return `${name} ${score(result.score)}`;
              })
              .join(' · ')}
          </span>
        </li>
      ))}
    </ol>
  );
}
