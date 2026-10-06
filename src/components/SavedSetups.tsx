// The host's saved setups (src/settings/saved.ts): save the lobby's settings under a name, load one into this
// lobby, or delete one. Loading says what had to change to fit this lobby.
import { useState } from 'react';
import type { FormEvent } from 'react';
import type { LobbySettings, SettingsBounds } from '../../shared/settings.ts';
import { MAX_SETUP_NAME, MAX_SETUPS, deleteSetup, fitSetup, readSetups, saveSetup } from '../settings/saved.ts';
import { localStore } from '../storage.ts';
import { Button, INPUT } from './ui.tsx';

interface SavedSetupsProps {
  settings: LobbySettings;
  bounds: SettingsBounds;
  onLoad: (settings: LobbySettings) => void;
}

export function SavedSetups({ settings, bounds, onLoad }: SavedSetupsProps) {
  const [storage] = useState(localStore);
  const [setups, setSetups] = useState(() => readSetups(storage));
  const [name, setName] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const save = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSetups(saveSetup(storage, setups, { name: trimmed, settings }));
    setStatus(`Saved "${trimmed}".`);
    setName('');
  };
  const load = (setupName: string, saved: unknown) => {
    const { settings: fitted, changes } = fitSetup(saved, bounds);
    onLoad(fitted);
    setStatus([`Loaded "${setupName}".`, ...changes].join(' '));
  };

  return (
    <details className="adjust">
      <summary className="adjust-summary">Saved setups</summary>
      <div className="mt-3 flex flex-col gap-3">
        <form className="flex flex-wrap items-end gap-2" onSubmit={save}>
          <label className="flex flex-1 flex-col gap-1.5">
            Save these settings as
            <input
              className={INPUT}
              value={name}
              maxLength={MAX_SETUP_NAME}
              placeholder="Friday 2000s"
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <Button type="submit" variant="quiet" disabled={!name.trim()}>
            Save
          </Button>
        </form>
        {setups.length > 0 && (
          <ul aria-label="Saved setups" className="flex flex-col divide-y divide-line">
            {setups.map((setup) => (
              <li key={setup.name} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere]">{setup.name}</span>
                <Button variant="quiet" onClick={() => load(setup.name, setup.settings)}>
                  Load<span className="sr-only"> {setup.name}</span>
                </Button>
                <button
                  type="button"
                  className="text-sm text-muted underline hover:text-bad"
                  onClick={() => setSetups(deleteSetup(storage, setups, setup.name))}
                >
                  Delete<span className="sr-only"> {setup.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-muted">
          Up to {MAX_SETUPS} setups, kept on this device. Saving under a name you used replaces that setup.
        </p>
        <p role="status" className="text-sm">
          {status}
        </p>
      </div>
    </details>
  );
}
