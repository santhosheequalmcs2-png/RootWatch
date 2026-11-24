import { useCallback, useEffect, useMemo, useState } from 'react';
import { soundEngine } from '../audio/soundEngine';

const STORAGE_KEY = 'rootwatch_ui_sound_muted';

export interface UiSoundController {
  muted: boolean;
  toggleMute: () => void;
  playHover: () => void;
  playSelect: (isExperimental?: boolean) => void;
  playToggle: (active: boolean) => void;
  playExplode: (exploded: boolean) => void;
  playReset: () => void;
  playDemoStart: () => void;
  playDemoStop: () => void;
  playDemoTransition: (stepNumber: number) => void;
  playScrub: () => void;
}

export function useUiSound(): UiSoundController {
  const [muted, setMuted] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    soundEngine.setMuted(muted);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(muted));
    } catch {
      // Ignore storage restrictions in sandboxed iframes
    }
  }, [muted]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      if (!next) {
        soundEngine.playToggle(true);
      }
      return next;
    });
  }, []);

  const playHover = useCallback(() => soundEngine.playHover(), []);
  const playSelect = useCallback(
    (isExperimental?: boolean) => soundEngine.playSelect(isExperimental),
    [],
  );
  const playToggle = useCallback((active: boolean) => soundEngine.playToggle(active), []);
  const playExplode = useCallback((exploded: boolean) => soundEngine.playExplode(exploded), []);
  const playReset = useCallback(() => soundEngine.playReset(), []);
  const playDemoStart = useCallback(() => soundEngine.playDemoStart(), []);
  const playDemoStop = useCallback(() => soundEngine.playDemoStop(), []);
  const playDemoTransition = useCallback(
    (stepNumber: number) => soundEngine.playDemoTransition(stepNumber),
    [],
  );
  const playScrub = useCallback(() => soundEngine.playScrub(), []);

  return useMemo(
    () => ({
      muted,
      toggleMute,
      playHover,
      playSelect,
      playToggle,
      playExplode,
      playReset,
      playDemoStart,
      playDemoStop,
      playDemoTransition,
      playScrub,
    }),
    [
      muted,
      toggleMute,
      playHover,
      playSelect,
      playToggle,
      playExplode,
      playReset,
      playDemoStart,
      playDemoStop,
      playDemoTransition,
      playScrub,
    ],
  );
}
