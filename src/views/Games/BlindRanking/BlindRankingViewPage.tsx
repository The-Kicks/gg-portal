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
  
  // --- 1. Haal de categorieën type-safe op ---
  const availableCategories = useMemo<string[]>(() => {
    const adminCategories = theme.gameSettings?.blindranking?.availableCategories;
    if (Array.isArray(adminCategories) && adminCategories.length > 0) {
      return adminCategories;
    }
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
      (appContainerEl as HTMLElement).style.height = '100vh';
      (appContainerEl as HTMLElement).style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    }
    return () => {
      if (appContainerEl) {
        (appContainerEl as HTMLElement).style.height = '';
        (appContainerEl as HTMLElement).style.overflow = '';
      }
      document.body.style.overflow = '';
    };
  }, [isPlaying]);

  // Helper om strings/arrays om te zetten naar schone URL arrays (buiten useMemo herbruikbaar)
  const parseRawMedia = useCallback((raw: string | string[] | undefined): string[] => {
    if (!raw) return [];
    if (typeof raw === 'string') {
      return raw.split(/\s+/).filter(url => url.trim() !== '');
    }
    if (Array.isArray(raw)) {
      return raw.filter((url): url is string => typeof url === 'string' && url.trim() !== '');
    }
    return [];
  }, []);

  // --- 4. Generieke functie om de complete medialijst voor een specifieke entiteit te bouwen ---
  const getMediaUrlsForEntity = useCallback((entity: HydratedEntity | undefined, category: string): string[] => {
    if (!entity?.image) return [];

    const imageContainer = entity.image as Record<string, string | string[] | undefined>;
    const imageKeys = Object.keys(imageContainer);
    const finalUrls: string[] = [];

    // STAP 1: Altijd profileCard en heroBanner eerst
    finalUrls.push(...parseRawMedia(imageContainer.profileCard));
    finalUrls.push(...parseRawMedia(imageContainer.heroBanner));

    // STAP 2: Zoek en voeg de media van de ACTIEVE categorie toe
    const matchedCategoryKey = imageKeys.find(key => 
      category.toLowerCase().includes(key.toLowerCase()) && 
      key !== 'profileCard' && 
      key !== 'heroBanner'
    );

    if (matchedCategoryKey) {
      finalUrls.push(...parseRawMedia(imageContainer[matchedCategoryKey]));
    }

    // STAP 3: ALTIJD DE REST achteraan sluiten
    imageKeys.forEach(key => {
      if (key !== 'profileCard' && key !== 'heroBanner' && key !== matchedCategoryKey) {
        finalUrls.push(...parseRawMedia(imageContainer[key]));
      }
    });

    return Array.from(new Set(finalUrls));
  }, [parseRawMedia]);

  // De actieve medialijst voor de huidige kaart op basis van de useMemo
  const currentMediaUrls = useMemo<string[]>(() => {
    return getMediaUrlsForEntity(currentEntity, activeCategory);
  }, [currentEntity, activeCategory, getMediaUrlsForEntity]);

  // --- 5. Bepaal de start-index van de categorie-specifieke media ---
  const getInitialMediaIndex = useCallback((entity: HydratedEntity | undefined, category: string): number => {
    if (!entity?.image) return 0;
    
    const urls = getMediaUrlsForEntity(entity, category);
    if (urls.length === 0) return 0;

    const imageContainer = entity.image as Record<string, string | string[] | undefined>;
    
    // Bereken hoeveel base-afbeeldingen er vooraan staan
    const profileCount = parseRawMedia(imageContainer.profileCard).length;
    const heroCount = parseRawMedia(imageContainer.heroBanner).length;
    const baseImagesCount = profileCount + heroCount;

    // Als er media is ná de profile/hero, start dan direct dáár (op index van de eerste categorie-afbeelding)
    if (urls.length > baseImagesCount) {
      return baseImagesCount;
    }

    // Fallback naar 0 als er niks anders is dan profile/hero
    return 0;
  }, [getMediaUrlsForEntity, parseRawMedia]);

  // --- 6. Check of de HUIDIG getoonde afbeelding bij de categorie hoort ---
  const isMatchingCategoryMedia = useMemo<boolean>(() => {
    if (!currentEntity?.image || currentMediaUrls.length === 0) return false;

    const imageContainer = currentEntity.image as Record<string, string | string[] | undefined>;
    const imageKeys = Object.keys(imageContainer);
    
    const currentActiveUrl = currentMediaUrls[currentMediaIndex];
    if (!currentActiveUrl) return false;

    // Profile/Hero uitsluiten van oplichten
    const profileUrls = parseRawMedia(imageContainer.profileCard);
    const heroUrls = parseRawMedia(imageContainer.heroBanner);
    const isProfileOrHero = profileUrls.includes(currentActiveUrl) || heroUrls.includes(currentActiveUrl);
    
    const categoryNameLower = activeCategory.toLowerCase();
    if (isProfileOrHero && !categoryNameLower.includes('profile') && !categoryNameLower.includes('hero')) {
      return false;
    }

    const matchedCategoryKey = imageKeys.find(key => 
      categoryNameLower.includes(key.toLowerCase()) && 
      key !== 'profileCard' && 
      key !== 'heroBanner'
    );

    if (!matchedCategoryKey) return false;

    const categoryUrls = parseRawMedia(imageContainer[matchedCategoryKey]);
    return categoryUrls.includes(currentActiveUrl);
  }, [currentEntity, currentMediaUrls, currentMediaIndex, activeCategory, parseRawMedia]);

  const { leftSlots, rightSlots } = useMemo(() => {
    const halfSlots = Math.ceil(maxSlots / 2);
    return {
      leftSlots: Array.from({ length: halfSlots }, (_, i) => i),
      rightSlots: Array.from({ length: maxSlots - halfSlots }, (_, i) => i + halfSlots)
    };
  }, [maxSlots]);

  // --- 7. Handlers ---
  const handleStartGame = useCallback((categoryName: string) => {
    if (availableEntities.length === 0) {
      alert("Dit thema bevat geen Layer 4 entiteiten om te ranken!");
      return;
    }

    const randomized = [...availableEntities]
      .sort(() => Math.random() - 0.5)
      .slice(0, 10);

    const firstEntity = randomized[0];
    // Bereken direct de juiste start-afbeelding voor de allereerste kaart
    const startingMediaIndex = getInitialMediaIndex(firstEntity, categoryName);

    setShuffledEntities(randomized);
    setRankings(Array(randomized.length).fill(null));
    setCurrentIndex(0);
    setCurrentMediaIndex(startingMediaIndex);
    setActiveCategory(categoryName);
    setIsPlaying(true);
  }, [availableEntities, getInitialMediaIndex]);

  const handlePlaceEntity = useCallback((slotIndex: number) => {
    if (rankings[slotIndex] !== null || currentIndex >= shuffledEntities.length) return;

    const activeCard = shuffledEntities[currentIndex];
    setRankings(prev => {
      const nextRankings = [...prev];
      nextRankings[slotIndex] = activeCard;
      return nextRankings;
    });

    const nextIndex = currentIndex + 1;
    const nextEntity = shuffledEntities[nextIndex];
    
    // Bereken alvast de juiste media-index voor de VOLGENDE kaart die in beeld komt
    const nextMediaStartingIndex = getInitialMediaIndex(nextEntity, activeCategory);

    setCurrentMediaIndex(nextMediaStartingIndex);
    setCurrentIndex(nextIndex);
  }, [currentIndex, shuffledEntities, rankings, activeCategory, getInitialMediaIndex]);

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
      isMatchingCategoryMedia={isMatchingCategoryMedia}
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