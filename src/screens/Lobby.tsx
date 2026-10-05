// The lobby between games: the invite (code, link and QR code), the players, the settings, and the start
// (docs/product-specs/lobby.md, settings.md).
import { useState } from 'react';
import type { LobbyState } from '../../shared/protocol.ts';
import type { LobbySettings } from '../../shared/settings.ts';
import { PlayerList } from '../components/PlayerList.tsx';
import { ReactionBar } from '../components/Reactions.tsx';
import { QrCode } from '../components/QrCode.tsx';
import { SettingsForm } from '../components/SettingsForm.tsx';
import { SettingsSummary } from '../components/SettingsSummary.tsx';
import { Button, INPUT, Panel } from '../components/ui.tsx';
import { usePagePhase } from '../hooks.ts';
import type { GameStore } from '../realtime/store.ts';

interface LobbyProps {
  store: GameStore;
  lobby: LobbyState;
  settings: LobbySettings;
  isHost: boolean;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  // The clipboard needs a secure context; elsewhere the link field still selects on focus.
  if (!navigator.clipboard) return null;
  return (
    <Button
      variant="quiet"
      onClick={() =>
        navigator.clipboard.writeText(text).then(
          () => setCopied(true),
          () => {},
        )
      }
    >
      {copied ? 'Copied' : 'Copy link'}
    </Button>
  );
}

function Invite({ code }: { code: string }) {
  const link = `${window.location.origin}/j/${code}`;
  return (
    <Panel title="Invite friends">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <QrCode text={link} label={`QR code of the join link for lobby ${code}`} />
        <div className="flex w-full flex-col gap-3">
          <p className="flex items-baseline gap-3">
            <span className="text-muted">Code</span>
            <span className="display lobby-code text-3xl">{code}</span>
          </p>
          <label className="flex flex-col gap-1.5">
            Join link
            <input className={INPUT} readOnly value={link} onFocus={(event) => event.target.select()} />
          </label>
          <CopyButton text={link} />
        </div>
      </div>
    </Panel>
  );
}

function StartBar({ store, lobby, settings, isHost }: LobbyProps) {
  const { pool } = lobby;
  // An anime plays at most once per game, so the anime count caps the songs.
  const tooFew = pool.anime < settings.songsPerGame;
  const matching = `${pool.themes.toLocaleString('en')} songs from ${pool.anime.toLocaleString('en')} anime match.`;
  return (
    <div className="start-bar sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3">
      <p className="flex-1 text-sm" aria-live="polite">
        {matching}
        {tooFew && isHost && ` Play at most ${pool.anime} songs, or widen the filters.`}
      </p>
      {isHost ? (
        <Button onClick={() => store.startGame()} disabled={tooFew}>
          Start game
        </Button>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted">
          <span aria-hidden="true" className="idle-meter">
            <span />
            <span />
            <span />
          </span>
          Waiting for the host to start.
        </p>
      )}
    </div>
  );
}

export function Lobby({ store, lobby, settings, isHost }: LobbyProps) {
  usePagePhase('lobby');
  return (
    <>
      <Invite code={lobby.code} />
      <Panel title={`Players (${lobby.players.length})`}>
        <PlayerList
          lobby={lobby}
          onKick={isHost ? (playerId) => store.kick(playerId) : null}
          showScores={lobby.game !== null}
        />
        <ReactionBar store={store} />
        {lobby.tally && (
          <p className="mt-2 text-sm text-muted">
            {lobby.tally.games === 1 ? '1 game' : `${lobby.tally.games} games`} played in this lobby
          </p>
        )}
        {isHost ? (
          <label className="mt-3 flex items-center gap-2">
            <input
              type="checkbox"
              className="choice"
              checked={lobby.locked}
              onChange={(event) => store.setLocked(event.target.checked)}
            />
            Lock the lobby, so nobody new can join
          </label>
        ) : (
          lobby.locked && <p className="mt-3 text-muted">The host locked the lobby.</p>
        )}
      </Panel>
      <Panel title="Game settings">
        {isHost ? (
          <SettingsForm settings={settings} bounds={lobby.bounds} onChange={(next) => store.updateSettings(next)} />
        ) : (
          <SettingsSummary settings={settings} bounds={lobby.bounds} />
        )}
      </Panel>
      <StartBar store={store} lobby={lobby} settings={settings} isHost={isHost} />
    </>
  );
}
