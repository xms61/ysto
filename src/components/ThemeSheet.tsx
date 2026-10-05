// The theme picker (docs/product-specs/settings.md): a full-screen sheet with every theme as a tile showing its
// world's object as an icon, in the world's own colors. Selecting a tile tries the world on across the whole page; "Use this world" keeps
// it, and Back or Escape puts back the theme the player had. "Surprise me" spins a highlight across the grid
// and lands on a random other world, at once when motion is reduced.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { THEMES } from '../prefs/prefs.ts';
import type { Theme } from '../prefs/prefs.ts';
import { THEME_NAMES, THEME_WORLDS } from '../themes/names.ts';
import { ThemeIcon } from './ThemeIcon.tsx';
import { buttonClass } from './ui.tsx';

const SPIN_HOPS = 12;

interface ThemeSheetProps {
  current: Theme;
  onUse: (theme: Theme) => void;
  onClose: () => void;
}

function randomOther(current: Theme): Theme {
  const others = THEMES.filter((theme) => theme !== current);
  return others[Math.floor(Math.random() * others.length)] ?? current;
}

// Each hop waits a little longer than the last, so the highlight slows to a stop.
function hopDelay(hop: number): number {
  return 50 + hop * hop * 2.5;
}

export function ThemeSheet({ current, onUse, onClose }: ThemeSheetProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const kept = useRef(false);
  const [tried, setTried] = useState<Theme>(current);
  const [lit, setLit] = useState<Theme | null>(null);
  const spin = useRef<number[]>([]);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    const timers = spin.current;
    return () => {
      timers.forEach(clearTimeout);
      if (!kept.current) document.documentElement.dataset.theme = current;
    };
  }, [current]);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = tried;
  }, [tried]);

  const surprise = () => {
    spin.current.splice(0).forEach(clearTimeout);
    const target = randomOther(current);
    if (document.documentElement.dataset.motion !== 'full') {
      setTried(target);
      return;
    }
    let at = 0;
    for (let hop = 0; hop < SPIN_HOPS; hop++) {
      at += hopDelay(hop);
      const shown = hop === SPIN_HOPS - 1 ? target : (THEMES[Math.floor(Math.random() * THEMES.length)] ?? target);
      spin.current.push(window.setTimeout(() => setLit(shown), at));
    }
    spin.current.push(
      window.setTimeout(() => {
        setLit(null);
        setTried(target);
      }, at + 160),
    );
  };

  const use = () => {
    kept.current = true;
    onUse(tried);
    onClose();
  };

  return createPortal(
    <dialog
      ref={dialog}
      aria-labelledby="theme-sheet-heading"
      className="theme-sheet"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="theme-sheet-head">
        <button type="button" className={buttonClass('quiet')} onClick={onClose}>
          Back
        </button>
        <h2 id="theme-sheet-heading" className="display text-xl">
          Choose a world
        </h2>
      </div>
      <div className="theme-scroll">
        <fieldset className="theme-grid">
          <legend className="sr-only">Theme</legend>
          {THEMES.map((theme) => (
            <label key={theme} data-theme={theme} className="theme-tile" data-lit={lit === theme || undefined}>
              <input
                type="radio"
                name="theme-sheet"
                className="sr-only"
                checked={theme === tried}
                onChange={() => setTried(theme)}
              />
              <span className="theme-tile-art">
                <ThemeIcon theme={theme} />
                <span aria-hidden="true" className="theme-tile-colors">
                  <span />
                  <span />
                  <span />
                  <span />
                </span>
              </span>
              <span className="theme-tile-name display">{THEME_NAMES[theme]}</span>
              {theme === tried && <span className="theme-tile-world">{THEME_WORLDS[theme]}</span>}
            </label>
          ))}
        </fieldset>
      </div>
      <div className="theme-sheet-foot">
        <button type="button" className={buttonClass('quiet')} onClick={surprise}>
          Surprise me
        </button>
        <button type="button" className={buttonClass('primary')} onClick={use}>
          Use this world
        </button>
      </div>
    </dialog>,
    document.body,
  );
}
