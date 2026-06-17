import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { Theme, HydratedEntity } from '../../../types';
import { BlindRankingView } from './BlindRankingView';

interface BlindRankingSettings {
  availableCategories?: string[];
  disabledCategories?: string[];
}

interface GameSettingsConfig {
  blindranking?: BlindRankingSettings;
}

export interface BlindRankingTheme extends Omit<Theme, 'gameSettings'> {
  gameSettings?: GameSettingsConfig;
}

interface Props {
  theme: BlindRankingTheme;
}

/**
 * Checks if a target entity ID is a parent or ancestor of a given entity
 * by searching top-down through the connections defined on the parent entities.
 *
 * @param currentEntityId The ID of the entity we want to trace upwards (e.g. an L4 idol ID)
 * @param targetL1Id The ID of the L1 category we want to match against
 * @param allEntities The entire hydrated graph from the theme dataset
 * @param depth Safety guard to prevent infinite traversal loops
 */
const checkL1ConnectionTopDown = (
  currentEntityId: string,
  targetL1Id: string,
  allEntities: HydratedEntity[],
  depth: number = 0
): boolean => {
  if (depth > 5) {
    return false;
  }

  const parents = allEntities.filter(potentialParent => 
    Array.isArray(potentialParent.connections) && 
    potentialParent.connections.some(conn => conn.targetEntityId === currentEntityId)
  );

  for (const parent of parents) {
    if (parent.id === targetL1Id) {
      return true;
    }
    
    const isMatchedHigherUp = checkL1ConnectionTopDown(parent.id, targetL1Id, allEntities, depth + 1);
    if (isMatchedHigherUp) {
      return true;
    }
  }

  return false;
};

export const BlindRankingViewPage: React.FC<Props> = ({ theme }) => {
  const allEntities = useMemo<HydratedEntity[]>(() => {
    return theme.entities || [];
  }, [theme.entities]);

  const playableEntities = useMemo<HydratedEntity[]>(() => {
    return allEntities.filter(e => e.type.toLowerCase() === 'l4');
  }, [allEntities]);

  return (
    <BlindRankingGameEngine 
      key={theme.id} 
      theme={theme} 
      allEntities={allEntities}
      availableEntities={playableEntities} 
    />
  );
};

interface EngineProps {
  theme: BlindRankingTheme;
  allEntities: HydratedEntity[];
  availableEntities: HydratedEntity[];
}

const BlindRankingGameEngine: React.FC<EngineProps> = ({ theme, allEntities, availableEntities }) => {
  
  const availableCategories = useMemo<string[]>(() => {
    const adminCategories = theme.gameSettings?.blindranking?.availableCategories;
    if (Array.isArray(adminCategories) && adminCategories.length > 0) {
      return adminCategories;
    }
    return ['Algemene Ranking'];
  }, [theme.gameSettings]);

  const l1Entities = useMemo<HydratedEntity[]>(() => {
    return allEntities.filter(e => e.type.toLowerCase() === 'l1');
  }, [allEntities]);

  // --- States ---
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [shuffledEntities, setShuffledEntities] = useState<HydratedEntity[]>([]);
  const [rankings, setRankings] = useState<(HydratedEntity | null)[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [currentMediaIndex, setCurrentMediaIndex] = useState<number>(0);

  const maxSlots = shuffledEntities.length;
  const currentEntity = shuffledEntities[currentIndex] as HydratedEntity | undefined;

  // Handle scroll lock style injection when game status changes
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

  const getMediaUrlsForEntity = useCallback((entity: HydratedEntity | undefined, category: string): string[] => {
    if (!entity?.image) return [];

    const imageContainer = entity.image as Record<string, string | string[] | undefined>;
    const imageKeys = Object.keys(imageContainer);
    const finalUrls: string[] = [];

    finalUrls.push(...parseRawMedia(imageContainer.profileCard));
    finalUrls.push(...parseRawMedia(imageContainer.heroBanner));

    const matchedCategoryKey = imageKeys.find(key => 
      category.toLowerCase().includes(key.toLowerCase()) && 
      key !== 'profileCard' && 
      key !== 'heroBanner'
    );

    if (matchedCategoryKey) {
      finalUrls.push(...parseRawMedia(imageContainer[matchedCategoryKey]));
    }

    imageKeys.forEach(key => {
      if (key !== 'profileCard' && key !== 'heroBanner' && key !== matchedCategoryKey) {
        finalUrls.push(...parseRawMedia(imageContainer[key]));
      }
    });

    return Array.from(new Set(finalUrls));
  }, [parseRawMedia]);

  const currentMediaUrls = useMemo<string[]>(() => {
    return getMediaUrlsForEntity(currentEntity, activeCategory);
  }, [currentEntity, activeCategory, getMediaUrlsForEntity]);

  const getInitialMediaIndex = useCallback((entity: HydratedEntity | undefined, category: string): number => {
    if (!entity?.image) return 0;
    
    const imageContainer = entity.image as Record<string, string | string[] | undefined>;
    const imageKeys = Object.keys(imageContainer);

    const matchedCategoryKey = imageKeys.find(key => 
      category.toLowerCase().includes(key.toLowerCase()) && 
      key !== 'profileCard' && 
      key !== 'heroBanner'
    );

    const categoryMediaUrls = matchedCategoryKey ? parseRawMedia(imageContainer[matchedCategoryKey]) : [];

    if (categoryMediaUrls.length === 0) {
      return 0;
    }

    const profileCount = parseRawMedia(imageContainer.profileCard).length;
    const heroCount = parseRawMedia(imageContainer.heroBanner).length;
    
    return profileCount + heroCount;
  }, [parseRawMedia]);

  const isMatchingCategoryMedia = useMemo<boolean>(() => {
    if (!currentEntity?.image || currentMediaUrls.length === 0) return false;

    const imageContainer = currentEntity.image as Record<string, string | string[] | undefined>;
    const imageKeys = Object.keys(imageContainer);
    
    const currentActiveUrl = currentMediaUrls[currentMediaIndex];
    if (!currentActiveUrl) return false;

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

  const handleStartGame = useCallback((categoryName: string) => {
    if (availableEntities.length === 0) {
      alert("Dit thema bevat geen Layer 4 entiteiten om te ranken!");
      return;
    }

    const matchedL1 = allEntities.find(e => 
      e.type.toLowerCase() === 'l1' && 
      e.name.toLowerCase() === categoryName.toLowerCase().trim()
    );

    let pool = [...availableEntities];

    if (matchedL1) {
      const filteredPool = availableEntities.filter(l4 => 
        checkL1ConnectionTopDown(l4.id, matchedL1.id, allEntities)
      );
      
      if (filteredPool.length > 0) {
        pool = filteredPool;
      } else {
        alert(`Er zijn geen Layer 4 kaarten gekoppeld aan L1 "${matchedL1.name}". We gebruiken de volledige pool.`);
      }
    }

    const randomized = pool
      .sort(() => Math.random() - 0.5)
      .slice(0, 10);

    const firstEntity = randomized[0];
    const startingMediaIndex = getInitialMediaIndex(firstEntity, categoryName);

    // Force window back to absolute top before applying 100vh lock container layout
    window.scrollTo({ top: 0, behavior: 'instant' });

    setShuffledEntities(randomized);
    setRankings(Array(randomized.length).fill(null));
    setCurrentIndex(0);
    setCurrentMediaIndex(startingMediaIndex);
    setActiveCategory(matchedL1 ? matchedL1.name : categoryName);
    setIsPlaying(true);
  }, [availableEntities, allEntities, getInitialMediaIndex]);

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
      l1Entities={l1Entities}
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
      l1Label={theme.labels?.l1 || 'Category'}
    />
  );
};