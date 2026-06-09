import React, { useState, useMemo, useCallback } from 'react';
import type { HydratedEntity } from '../../../types';
import { GuessWhoView } from './GuessWhoView';
import type { GuessWhoTheme } from './GuessWhoView';

export interface GuessRow {
  entity: HydratedEntity;
  checks: {
    name: 'correct' | 'incorrect';
    org: 'correct' | 'incorrect';
    nationality: 'correct' | 'partial' | 'incorrect';
    role: 'correct' | 'partial' | 'incorrect';
    debut: 'correct' | 'incorrect' | 'higher' | 'lower';
    age: 'correct' | 'incorrect' | 'higher' | 'lower';
    height: 'correct' | 'incorrect' | 'higher' | 'lower';
  };
  arrows: {
    debut: string;
    age: string;
    height: string;
  };
  displayOrg: string;
}

interface Props {
  theme: GuessWhoTheme;
}

// ============================================================================
// STANDALONE PURE UTILITY FUNCTIONS 
// ============================================================================

/**
 * Split strings of arrays op basis van zowel slashes (/) als komma's (,) zonder regex literals
 */
const parseMetaToCleanArray = (value: unknown): string[] => {
  if (!value) return [];
  
  const rawString = Array.isArray(value) ? value.join('/') : String(value);
  
  return rawString
    .split(',')
    .flatMap(v => v.split('/'))
    .map(v => v.trim().toLowerCase())
    .filter(Boolean);
};

/**
 * Evalueert arrays (posities, nationaliteiten) op exact, partial of incorrect
 */
const evaluateArrayMatch = (guessArr: string[], secretArr: string[]): 'correct' | 'partial' | 'incorrect' => {
  if (guessArr.length === 0 || secretArr.length === 0) {
    return guessArr.length === secretArr.length ? 'correct' : 'incorrect';
  }

  const isExact = guessArr.length === secretArr.length && guessArr.every(item => secretArr.includes(item));
  if (isExact) return 'correct';

  const hasMatch = guessArr.some(item => secretArr.includes(item));
  if (hasMatch) return 'partial';

  return 'incorrect';
};

const evaluateNumericMetric = (guessNum: number, secretNum: number, invertLogic = false) => {
  if (!guessNum || !secretNum || guessNum === secretNum) {
    return { check: 'correct' as const, arrow: '' };
  }

  const isLessThanSecret = guessNum < secretNum;
  return {
    check: (isLessThanSecret ? (invertLogic ? 'lower' : 'higher') : (invertLogic ? 'higher' : 'lower')) as 'higher' | 'lower',
    arrow: isLessThanSecret ? '⬆️' : '⬇️'
  };
};

// ============================================================================
// REACT COMPONENTS
// ============================================================================

export const GuessWhoViewPage: React.FC<Props> = ({ theme }) => {
  const playableEntities = useMemo<HydratedEntity[]>(() => {
    if (!theme.entities) return [];
    return theme.entities.filter(e => e.type.toLowerCase() === 'l4');
  }, [theme.entities]);

  return <GuessWhoGameEngine key={theme.id} theme={theme} availableEntities={playableEntities} />;
};

interface EngineProps {
  theme: GuessWhoTheme;
  availableEntities: HydratedEntity[];
}

const GuessWhoGameEngine: React.FC<EngineProps> = ({ theme, availableEntities }) => {
  const [secretEntity, setSecretEntity] = useState<HydratedEntity | null>(() => {
    if (availableEntities.length === 0) return null;
    return availableEntities[Math.floor(Math.random() * availableEntities.length)];
  });

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [guesses, setGuesses] = useState<GuessRow[]>([]);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);

  const startNewGame = useCallback<() => void>(() => {
    if (availableEntities.length === 0) {
      setSecretEntity(null);
      return;
    }
    setSecretEntity(availableEntities[Math.floor(Math.random() * availableEntities.length)]);
    setGuesses([]);
    setGameOver(false);
    setSearchQuery('');
  }, [availableEntities]);

  const getOrganizationName = useCallback((entity: HydratedEntity): string => {
    const orgLayerKey = theme.orgLayer || 'l3';
    const connection = entity.targetConnections?.find(
      c => c.sourceEntity?.type.toLowerCase() === orgLayerKey.toLowerCase()
    );
    return connection?.sourceEntity?.name || '';
  }, [theme.orgLayer]);

  const getAgeFromDateString = useCallback((birthDateStr?: unknown, passingDateStr?: unknown): number => {
    if (typeof birthDateStr !== 'string') return 0;

    const birthParts = birthDateStr.split('-');
    if (birthParts.length !== 3) return 0;

    const birthDay = parseInt(birthParts[0], 10);
    const birthMonth = parseInt(birthParts[1], 10) - 1;
    const birthYear = parseInt(birthParts[2], 10);

    if (isNaN(birthDay) || isNaN(birthMonth) || isNaN(birthYear)) return 0;

    const birthDate = new Date(birthYear, birthMonth, birthDay);
    
    let endDate = new Date();
    if (typeof passingDateStr === 'string') {
      const passingParts = passingDateStr.split('-');
      if (passingParts.length === 3) {
        const pDay = parseInt(passingParts[0], 10);
        const pMonth = parseInt(passingParts[1], 10) - 1;
        const pYear = parseInt(passingParts[2], 10);
        if (!isNaN(pDay) && !isNaN(pMonth) && !isNaN(pYear)) {
          endDate = new Date(pYear, pMonth, pDay);
        }
      }
    }

    let age = endDate.getFullYear() - birthDate.getFullYear();
    const monthDiff = endDate.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && endDate.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  }, []);

  const filteredDropdownOptions = useMemo<HydratedEntity[]>(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();

    const matches: HydratedEntity[] = [];
    for (const e of availableEntities) {
      if (matches.length >= 8) break;
      const isAlreadyGuessed = guesses.some(g => g.entity.id === e.id);
      if (e.name.toLowerCase().includes(query) && !isAlreadyGuessed) {
        matches.push(e);
      }
    }
    return matches;
  }, [searchQuery, availableEntities, guesses]);

  const handleSelectGuess = useCallback((guessedEntity: HydratedEntity): void => {
    if (!secretEntity || gameOver) return;

    const secretOrg = getOrganizationName(secretEntity);
    const guessOrg = getOrganizationName(guessedEntity);

    const sMeta = (secretEntity.metadata || {}) as Record<string, unknown>;
    const gMeta = (guessedEntity.metadata || {}) as Record<string, unknown>;

    const nationalityStatus = evaluateArrayMatch(parseMetaToCleanArray(gMeta.Nationality), parseMetaToCleanArray(sMeta.Nationality));
    const roleStatus = evaluateArrayMatch(parseMetaToCleanArray(gMeta.Role), parseMetaToCleanArray(sMeta.Role));

    const debutMetric = evaluateNumericMetric(Number(gMeta.DebutYear || 0), Number(sMeta.DebutYear || 0));
    const ageMetric = evaluateNumericMetric(
      getAgeFromDateString(gMeta.Birthday, gMeta.PassingDate),
      getAgeFromDateString(sMeta.Birthday, sMeta.PassingDate)
    );
    const heightMetric = evaluateNumericMetric(Number(gMeta.Height || 0), Number(sMeta.Height || 0), true);

    const newRow: GuessRow = {
      entity: guessedEntity,
      displayOrg: guessOrg || 'Independent',
      checks: {
        name: guessedEntity.id === secretEntity.id ? 'correct' : 'incorrect',
        org: (secretOrg && guessOrg && secretOrg === guessOrg) ? 'correct' : 'incorrect',
        nationality: nationalityStatus,
        role: roleStatus,
        debut: debutMetric.check,
        age: ageMetric.check,
        height: heightMetric.check,
      },
      arrows: {
        debut: debutMetric.arrow,
        age: ageMetric.arrow,
        height: heightMetric.arrow,
      }
    };

    setGuesses(prev => [newRow, ...prev]);
    setSearchQuery('');
    setShowDropdown(false);

    if (guessedEntity.id === secretEntity.id) {
      setGameOver(true);
    }
  }, [secretEntity, gameOver, getOrganizationName, getAgeFromDateString]);

  if (!secretEntity) {
    return <div style={{ color: '#fff', padding: '20px' }}>Loading dynamic records...</div>;
  }

  return (
    <GuessWhoView
      theme={theme}
      secretEntity={secretEntity}
      searchQuery={searchQuery}
      guesses={guesses}
      gameOver={gameOver}
      showDropdown={showDropdown}
      filteredDropdownOptions={filteredDropdownOptions}
      setSearchQuery={setSearchQuery}
      setShowDropdown={setShowDropdown}
      startNewGame={startNewGame}
      handleSelectGuess={handleSelectGuess}
      getAgeFromDateString={getAgeFromDateString}
    />
  );
};