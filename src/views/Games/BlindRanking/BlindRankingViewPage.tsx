import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { Theme, HydratedEntity } from '../../../types';
import { BlindRankingView } from './BlindRankingView';

// --- Strikte Type Definities op basis van jouw API Response ---
interface BlindRankingSettings {
  availableCategories?: string[];
  disabledCategories?: string[];
}

interface GuessWhoSettings {
  disabledColumns?: string[];
}

interface GameSettingsConfig {
  blindranking?: BlindRankingSettings;
  guesswho?: GuessWhoSettings;
}

// Breid het standaard Theme type uit met de exacte structuur uit de database
export interface BlindRankingTheme extends Omit<Theme, 'gameSettings'> {
  gameSettings?: GameSettingsConfig;
}

interface Props {
  theme: BlindRankingTheme;
}

export const BlindRankingViewPage: React.FC<Props> = ({ theme }) => {
  const playableEntities = useMemo<HydratedEntity[]>(() => {
    if (!theme.entities) return [];
    return theme.entities.filter(e => e.type.toLowerCase() === 'l4');
  }, [theme.entities]);

  return <BlindRankingGameEngine key={theme.id} theme={theme} availableEntities={playableEntities} />;
};

interface EngineProps {
  theme: BlindRankingTheme;
  availableEntities: HydratedEntity[];
}

const BlindRankingGameEngine: React.FC<EngineProps> = ({ theme, availableEntities }) => {
  
  // --- 1. Haal de categorieën type-safe op uit de JSON-structuur ---
  const availableCategories = useMemo<string[]>(() => {
    const adminCategories = theme.gameSettings?.blindranking?.availableCategories;
    
    if (Array.isArray(adminCategories) && adminCategories.length > 0) {
      return adminCategories;
    }

    // Veilige fallback mocht de database onverhoopt leeg zijn
    return ['Algemene Ranking'];
  }, [theme.gameSettings]);

  // --- 2. Gameplay States ---
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [shuffledEntities, setShuffledEntities] = useState<HydratedEntity[]>([]);
  const [rankings, setRankings] = useState<(HydratedEntity | null)[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [currentMediaIndex, setCurrentMediaIndex] = useState<number>(0);

  const maxSlots = shuffledEntities.length;
  const currentEntity = shuffledEntities[currentIndex] as HydratedEntity | undefined;

  // --- 3. TIJDELIJKE SCROLL-LOCK OP DE APP CONTAINER ---
  useEffect(() => {
    const appContainerEl = document.querySelector('.app-container');
    
    if (isPlaying && appContainerEl) {
      // Forceer de app-container op de exacte hoogte van het scherm en zet scrollen uit
      (appContainerEl as HTMLElement).style.height = '100vh';
      (appContainerEl as HTMLElement).style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    }

    // Grote schoonmaak: herstel de originele layout zodra de game sluit of de component unmount
    return () => {
      if (appContainerEl) {
        (appContainerEl as HTMLElement).style.height = '';
        (appContainerEl as HTMLElement).style.overflow = '';
      }
      document.body.style.overflow = '';
    };
  }, [isPlaying]);

  // --- 4. Media Parser (Verwerkt spaties in strings & mapt op actieve categorie) ---
  const currentMediaUrls = useMemo<string[]>(() => {
    if (!currentEntity?.image) return [];

    const imageContainer = currentEntity.image as Record<string, string | string[] | undefined>;
    const imageKeys = Object.keys(imageContainer);
    
    // Zoek naar een matchende key (bijv. 'Face' of 'Body') in de huidige categorie
    const matchedKey = imageKeys.find(key => 
      activeCategory.toLowerCase().includes(key.toLowerCase())
    );

    const rawMedia = matchedKey ? imageContainer[matchedKey] : null;

    if (!rawMedia) {
      // Fallback naar standaard afbeeldingen als de specifieke categorie-media ontbreekt
      const fallback = imageContainer.profileCard || imageContainer.heroBanner;
      if (typeof fallback === 'string' && fallback.trim() !== '') {
        return [fallback];
      }
      return [];
    }

    // Als de database-waarde een string is met spaties ("url1 url2"), splits deze op
    if (typeof rawMedia === 'string') {
      return rawMedia.split(/\s+/).filter(url => url.trim() !== '');
    }

    if (Array.isArray(rawMedia)) {
      return rawMedia.filter((url): url is string => typeof url === 'string' && url.trim() !== '');
    }

    return [];
  }, [currentEntity, activeCategory]);

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

    const randomized = [...availableEntities]
      .sort(() => Math.random() - 0.5)
      .slice(0, 10);

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