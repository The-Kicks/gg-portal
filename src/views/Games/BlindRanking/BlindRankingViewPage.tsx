import React, { useState, useMemo, useCallback } from 'react';
import type { Theme, HydratedEntity } from '../../../types';
import { BlindRankingView } from './BlindRankingView';

interface Props {
  theme: Theme;
}

export const BlindRankingViewPage: React.FC<Props> = ({ theme }) => {
  const playableEntities = useMemo<HydratedEntity[]>(() => {
    if (!theme.entities) return [];
    return theme.entities.filter(e => e.type.toLowerCase() === 'l4');
  }, [theme.entities]);

  return <BlindRankingGameEngine key={theme.id} theme={theme} availableEntities={playableEntities} />;
};

interface EngineProps {
  theme: Theme;
  availableEntities: HydratedEntity[];
}

const BlindRankingGameEngine: React.FC<EngineProps> = ({ theme, availableEntities }) => {
  // --- 1. Extraheer L4 Media Keys dynamisch uit het Themaschema ---
  const dynamicMediaKeys = useMemo<string[]>(() => {
    if (!theme.layerMetadata) return [];
    try {
      const parsed = typeof theme.layerMetadata === 'string'
        ? JSON.parse(theme.layerMetadata)
        : theme.layerMetadata;
      
      const l4Config = parsed && (parsed['l4'] || parsed['L4']);
      if (l4Config && Array.isArray(l4Config.mediaKeys)) {
        return l4Config.mediaKeys;
      }
    } catch (e) {
      console.error("Fout bij parsen van mediaKeys:", e);
    }
    return [];
  }, [theme.layerMetadata]);

  // --- 2. Genereer Beschikbare Categorieën (Puur Read-Only) ---
  const availableCategories = useMemo<string[]>(() => {
    const base = [
      'Algemene Ranking / Prestaties',
      'Historische Impact & Legacy'
    ];
    const mediaOptions = dynamicMediaKeys.map(key => `Asset: ${key}`);
    return [...base, ...mediaOptions];
  }, [dynamicMediaKeys]);

  // --- 3. Actieve Gameplay States ---
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [shuffledEntities, setShuffledEntities] = useState<HydratedEntity[]>([]);
  const [rankings, setRankings] = useState<(HydratedEntity | null)[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [currentMediaIndex, setCurrentMediaIndex] = useState<number>(0);

  // --- 4. Afgeleide Gegevens (Pure useMemos) ---
  const maxSlots = shuffledEntities.length;
  const currentEntity = shuffledEntities[currentIndex] as HydratedEntity | undefined;

  const currentMediaUrls = useMemo<string[]>(() => {
    if (!currentEntity?.image) return [];
    return Object.values(currentEntity.image)
      .flatMap(val => (Array.isArray(val) ? val : [val]))
      .filter((url): url is string => typeof url === 'string' && url.trim() !== '');
  }, [currentEntity]);

  const { leftSlots, rightSlots } = useMemo(() => {
    const halfSlots = Math.ceil(maxSlots / 2);
    return {
      leftSlots: Array.from({ length: halfSlots }, (_, i) => i),
      rightSlots: Array.from({ length: maxSlots - halfSlots }, (_, i) => i + halfSlots)
    };
  }, [maxSlots]);

  // --- 5. Handlers ---
  const handleStartGame = useCallback((categoryName: string) => {
    if (availableEntities.length === 0) {
      alert("Dit thema bevat geen Layer 4 entiteiten om te ranken!");
      return;
    }

    // Shuffelen gebeurt veilig binnen de event handler
    const randomized = [...availableEntities]
      .sort(() => Math.random() - 0.5)
      .slice(0, 10); // Maximaal 10 kaarten

    setShuffledEntities(randomized);
    setRankings(Array(randomized.length).fill(null));
    setCurrentIndex(0);
    setCurrentMediaIndex(0);
    setActiveCategory(categoryName);
    setIsPlaying(true);
  }, [availableEntities]);

  const handlePlaceEntity = useCallback((slotIndex: number) => {
    if (rankings[slotIndex] !== null || currentIndex >= shuffledEntities.length) return;

    const activeCard = shuffledEntities[currentIndex];
    setRankings(prev => {
      const nextRankings = [...prev];
      nextRankings[slotIndex] = activeCard;
      return nextRankings;
    });

    setCurrentMediaIndex(0);
    setCurrentIndex(prev => prev + 1);
  }, [currentIndex, shuffledEntities, rankings]);

  const handleNextMedia = useCallback(() => {
    if (currentMediaUrls.length <= 1) return;
    setCurrentMediaIndex(prev => (prev + 1) % currentMediaUrls.length);
  }, [currentMediaUrls]);

  const handlePrevMedia = useCallback(() => {
    if (currentMediaUrls.length <= 1) return;
    setCurrentMediaIndex(prev => (prev - 1 + currentMediaUrls.length) % currentMediaUrls.length);
  }, [currentMediaUrls]);

  return (
    <BlindRankingView
      isPlaying={isPlaying}
      availableCategories={availableCategories}
      activeCategory={activeCategory}
      currentEntity={currentEntity}
      currentMediaUrls={currentMediaUrls}
      currentMediaIndex={currentMediaIndex}
      rankings={rankings}
      currentIndex={currentIndex}
      maxSlots={maxSlots}
      leftSlots={leftSlots}
      rightSlots={rightSlots}
      setIsPlaying={setIsPlaying}
      handleStartGame={handleStartGame}
      handlePlaceEntity={handlePlaceEntity}
      handleNextMedia={handleNextMedia}
      handlePrevMedia={handlePrevMedia}
    />
  );
};