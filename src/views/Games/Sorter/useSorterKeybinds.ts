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
}: UseSorterKeybindsProps) {
  // LATEST REF PATTERN: Voorkomt linter-waarschuwingen en onnodige re-binds van window listeners
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
    };
  });

  const heldKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      heldKeys.current.add(e.key);
      heldKeys.current.add(e.code);

      const isHoldingZero = heldKeys.current.has('0') || heldKeys.current.has('Numpad0');
      const isHoldingEnter = heldKeys.current.has('Enter') || heldKeys.current.has('NumpadEnter');

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

      // TOETS 4 (Links stemmen / hold modifiers)
      if (e.key === '4' || e.code === 'Numpad4' || e.key === 'ArrowLeft') {
        e.preventDefault();
        if (isHoldingZero) {
          currentToggleFav('left');
        } else if (isHoldingEnter && lUrl) {
          window.open(lUrl, '_blank');
        } else if (!isHoldingZero && !isHoldingEnter) {
          currentVote('A');
        }
      }

      // TOETS 6 (Rechts stemmen / hold modifiers)
      if (e.key === '6' || e.code === 'Numpad6' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (isHoldingZero) {
          currentToggleFav('right');
        } else if (isHoldingEnter && rUrl) {
          window.open(rUrl, '_blank');
        } else if (!isHoldingZero && !isHoldingEnter) {
          currentVote('B');
        }
      }

      // TOETS 5 (Undo)
      if (e.key === '5' || e.code === 'Numpad5') {
        e.preventDefault();
        if (currentCanUndo) currentUndo();
      }

      // CARROUSEL KEYBINDS
      if (e.key === '7' || e.code === 'Numpad7') {
        e.preventDefault();
        setLIdx((prev) => Math.max(0, prev - 1));
      }
      if (e.key === '1' || e.code === 'Numpad1') {
        e.preventDefault();
        setLIdx((prev) => Math.min(lMedia.length - 1, prev + 1));
      }
      if (e.key === '9' || e.code === 'Numpad9') {
        e.preventDefault();
        setRIdx((prev) => Math.max(0, prev - 1));
      }
      if (e.key === '3' || e.code === 'Numpad3') {
        e.preventDefault();
        setRIdx((prev) => Math.min(rMedia.length - 1, prev + 1));
      }
      if (e.key === '8' || e.code === 'Numpad8' || e.key === 'ArrowUp') {
        e.preventDefault();
        setLIdx((prev) => Math.max(0, prev - 1));
        setRIdx((prev) => Math.max(0, prev - 1));
      }
      if (e.key === '2' || e.code === 'Numpad2' || e.key === 'ArrowDown') {
        e.preventDefault();
        setLIdx((prev) => Math.min(lMedia.length - 1, prev + 1));
        setRIdx((prev) => Math.min(rMedia.length - 1, prev + 1));
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