// A seat in a lobby: one store and socket for as long as this tab holds the seat. It shows the lobby, the
// round or the results, depending on where the lobby's game stands.
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { AudioEngine } from '../audio/engine.ts';
import { NoticeToast } from '../components/NoticeToast.tsx';
import { PreferencesMenu } from '../components/PrefsPanel.tsx';
import { SoundBanner } from '../components/SoundBanner.tsx';
import { ConfirmButton, Panel } from '../components/ui.tsx';
import type { Prefs } from '../prefs/prefs.ts';
import type { ExitReason, SocketLike } from '../realtime/connection.ts';
import { isHost } from '../realtime/game-state.ts';
import type { GameState } from '../realtime/game-state.ts';
import type { Session } from '../realtime/session.ts';
import { GameStore } from '../realtime/store.ts';
import { Lobby } from './Lobby.tsx';
import { Results } from './Results.tsx';
import { Round } from './Round.tsx';

interface LobbySessionProps {
  session: Session;
  audio: AudioEngine;
  prefs: Prefs;
  onPrefs: (change: Partial<Prefs>) => void;
  onExit: (reason: ExitReason) => void;
  createSocket?: (url: string) => SocketLike;
}

function screenOf(game: GameState): 'lobby' | 'round' | 'results' {
  const phase = game.lobby?.game?.phase;
  if (phase === 'playing') return 'round';
  if (phase === 'results' && !game.resultsClosed) return 'results';
  return 'lobby';
}

// A tab that comes back into view, or a device back online, reconnects at once instead of after its wait.
function useRetryOnReturn(store: GameStore): void {
  useEffect(() => {
    const retry = () => {
      if (document.visibilityState === 'visible') store.retryNow();
    };
    document.addEventListener('visibilitychange', retry);
    window.addEventListener('online', retry);
    return () => {
      document.removeEventListener('visibilitychange', retry);
      window.removeEventListener('online', retry);
    };
  }, [store]);
}

export function LobbySession({ session, audio, prefs, onPrefs, onExit, createSocket }: LobbySessionProps) {
  const [store] = useState(() => new GameStore({ session, audio, onExit, createSocket }));
  useEffect(() => {
    store.connect();
    return () => store.disconnect();
  }, [store]);
  useRetryOnReturn(store);
  const { status, game, settings, notice } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const lobby = game.lobby;
  const host = isHost(game);
  const screen = screenOf(game);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-4 px-4 py-4">
      <header className="relative flex flex-wrap items-center gap-3">
        <h1 className="display text-lg">
          Lobby <span className="font-mono tracking-widest">{session.code}</span>
        </h1>
        {status === 'reconnecting' && (
          <span role="status" className="text-sm text-muted">
            Reconnecting…
          </span>
        )}
        <PreferencesMenu prefs={prefs} onChange={onPrefs} />
        <ConfirmButton label="Leave" question="Leave the lobby?" onConfirm={() => store.leave()} />
      </header>
      <SoundBanner audio={audio} />
      {!lobby || !settings ? (
        <Panel>
          <p aria-live="polite">Connecting to the lobby…</p>
        </Panel>
      ) : screen === 'round' ? (
        <Round store={store} lobby={lobby} round={game.round} titleLanguage={prefs.titleLanguage} isHost={host} />
      ) : screen === 'results' ? (
        <Results store={store} lobby={lobby} isHost={host} />
      ) : (
        <Lobby store={store} lobby={lobby} settings={settings} isHost={host} />
      )}
      <NoticeToast notice={notice} store={store} />
    </div>
  );
}
