import { useEffect, useRef } from 'react';

interface UseSorterKeybindsProps {
  onProcessVote: (winner: 'A' | 'B') => void;
  onUndo: () => void;
  canUndo: boolean;
  toggleFavorite: (side: 'left' | 'right') => void;
  leftItemMedia: string[];
  rightItemMedia: string[];
  currentLeftMediaUrl: string;
  currentRightMediaUrl: string;
  setLeftMediaIndex: React.Dispatch<React.SetStateAction<number>>;
  setRightMediaIndex: React.Dispatch<React.SetStateAction<number>>;
  enabled?: boolean;
}

export function useSorterKeybinds({
  onProcessVote,
  onUndo,
  canUndo,
  toggleFavorite,
  leftItemMedia,
  rightItemMedia,
  currentLeftMediaUrl,
  currentRightMediaUrl,
  setLeftMediaIndex,
  setRightMediaIndex,
  enabled = true,
}: UseSorterKeybindsProps) {
  const actionsRef = useRef({
    onProcessVote,
    onUndo,
    canUndo,
    toggleFavorite,
    leftItemMedia,
    rightItemMedia,
    currentLeftMediaUrl,
    currentRightMediaUrl,
    setLeftMediaIndex,
    setRightMediaIndex,
    enabled,
  });

  useEffect(() => {
    actionsRef.current = {
      onProcessVote,
      onUndo,
      canUndo,
      toggleFavorite,
      leftItemMedia,
      rightItemMedia,
      currentLeftMediaUrl,
      currentRightMediaUrl,
      setLeftMediaIndex,
      setRightMediaIndex,
      enabled,
    };
  });

  const heldKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleFullscreen = (side: 'left' | 'right') => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
        return;
      }

      const columnEl = document.querySelector(`[data-side="${side}"]`);
      if (!columnEl) return;

      const target = columnEl.querySelector('[data-fullscreen-target]');
      if (target) {
        target.requestFullscreen().catch((err) => {
          console.error("Fullscreen toggle mislukt:", err);
        });
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!actionsRef.current.enabled) return;

      heldKeys.current.add(e.key);
      heldKeys.current.add(e.code);

      const isHoldingZero = heldKeys.current.has('0') || heldKeys.current.has('Numpad0');
      const isHoldingEnter = heldKeys.current.has('Enter') || heldKeys.current.has('NumpadEnter');
      const isHoldingDecimal = heldKeys.current.has('.') || heldKeys.current.has('NumpadDecimal');

      const {
        onProcessVote: currentVote,
        onUndo: currentUndo,
        canUndo: currentCanUndo,
        toggleFavorite: currentToggleFav,
        leftItemMedia: lMedia,
        rightItemMedia: rMedia,
        currentLeftMediaUrl: lUrl,
        currentRightMediaUrl: rUrl,
        setLeftMediaIndex: setLIdx,
        setRightMediaIndex: setRIdx,
      } = actionsRef.current;

      // TOETS 4 / ArrowLeft (Links stemmen / modifiers)
      if (e.key === '4' || e.code === 'Numpad4' || e.key === 'ArrowLeft') {
        e.preventDefault();
        if (isHoldingZero) {
          currentToggleFav('left');
        } else if (isHoldingEnter && lUrl) {
          window.open(lUrl, '_blank');
        } else if (isHoldingDecimal) {
          handleFullscreen('left');
        } else if (!isHoldingZero && !isHoldingEnter && !isHoldingDecimal) {
          currentVote('A');
        }
      }

      // TOETS 6 / ArrowRight (Rechts stemmen / modifiers)
      if (e.key === '6' || e.code === 'Numpad6' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (isHoldingZero) {
          currentToggleFav('right');
        } else if (isHoldingEnter && rUrl) {
          window.open(rUrl, '_blank');
        } else if (isHoldingDecimal) {
          handleFullscreen('right');
        } else if (!isHoldingZero && !isHoldingEnter && !isHoldingDecimal) {
          currentVote('B');
        }
      }

      // TOETS 5 (Undo)
      if (e.key === '5' || e.code === 'Numpad5') {
        e.preventDefault();
        if (currentCanUndo) currentUndo();
      }

      // CARROUSEL KEYBINDS (Oneindige loop)
      if (e.key === '7' || e.code === 'Numpad7') {
        e.preventDefault();
        if (lMedia.length > 1) {
          setLIdx((prev) => (prev === 0 ? lMedia.length - 1 : prev - 1));
        }
      }
      if (e.key === '1' || e.code === 'Numpad1') {
        e.preventDefault();
        if (lMedia.length > 1) {
          setLIdx((prev) => (prev === lMedia.length - 1 ? 0 : prev + 1));
        }
      }
      if (e.key === '9' || e.code === 'Numpad9') {
        e.preventDefault();
        if (rMedia.length > 1) {
          setRIdx((prev) => (prev === 0 ? rMedia.length - 1 : prev - 1));
        }
      }
      if (e.key === '3' || e.code === 'Numpad3') {
        e.preventDefault();
        if (rMedia.length > 1) {
          setRIdx((prev) => (prev === rMedia.length - 1 ? 0 : prev + 1));
        }
      }
      if (e.key === '8' || e.code === 'Numpad8' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (lMedia.length > 1) setLIdx((prev) => (prev === 0 ? lMedia.length - 1 : prev - 1));
        if (rMedia.length > 1) setRIdx((prev) => (prev === 0 ? rMedia.length - 1 : prev - 1));
      }
      if (e.key === '2' || e.code === 'Numpad2' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (lMedia.length > 1) setLIdx((prev) => (prev === lMedia.length - 1 ? 0 : prev + 1));
        if (rMedia.length > 1) setRIdx((prev) => (prev === rMedia.length - 1 ? 0 : prev + 1));
      }

      // TOETS . of NumpadDecimal
      if (e.key === '.' || e.code === 'NumpadDecimal') {
        e.preventDefault();
        // Als we al fullscreen zijn, sluit het direct bij het indrukken van de punt
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      heldKeys.current.delete(e.key);
      heldKeys.current.delete(e.code);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
}