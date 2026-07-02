import React, { useState, useMemo, useCallback } from 'react';
import type { HydratedEntity } from '../../../types';
import { GuessWhoView } from './GuessWhoView';
import type { GuessWhoTheme } from './GuessWhoView';

export interface GuessRow {
  entity: HydratedEntity;
  checks: {
    name: 'correct' | 'incorrect';
    org: 'correct' | 'partial' | 'incorrect';
    nationality: 'correct' | 'partial' | 'incorrect';
    role: 'correct' | 'partial' | 'incorrect';
    debut: 'correct' | 'incorrect' | 'higher' | 'lower';
    age: 'correct' | 'incorrect' | 'higher' | 'lower';
    height: 'correct' | 'incorrect' | 'higher' | 'lower';
  };
  arrows: { debut: string; age: string; height: string; };
  displayOrg: string;
}

interface OrgMetadata {
  startDate?: string;
  endDate?: string;
}

/**
 * Normalizes multi-value metadata string parameters or nested array references into uniform string lists.
 */
const parseMetaToCleanArray = (value: unknown): string[] => {
  if (!value) return [];
  const rawString = Array.isArray(value) ? value.join('/') : String(value);
  return rawString.split(',').flatMap(v => v.split('/')).map(v => v.trim().toLowerCase()).filter(Boolean);
};

/**
 * Validates set relationships between input tags to determine structural overlap or identities.
 */
const evaluateArrayMatch = (guessArr: string[], secretArr: string[]): 'correct' | 'partial' | 'incorrect' => {
  if (guessArr.length === 0 || secretArr.length === 0) {
    return guessArr.length === secretArr.length ? 'correct' : 'incorrect';
  }
  const isExact = guessArr.length === secretArr.length && guessArr.every(item => secretArr.includes(item));
  if (isExact) return 'correct';
  return guessArr.some(item => secretArr.includes(item)) ? 'partial' : 'incorrect';
};

/**
 * Calculates differences across scalar boundaries to produce direction markers and structural check tags.
 */
const evaluateNumericMetric = (guessNum: number, secretNum: number, invertLogic = false) => {
  if (!guessNum || !secretNum || guessNum === secretNum) return { check: 'correct' as const, arrow: '' };
  const isLessThanSecret = guessNum < secretNum;
  return {
    check: (isLessThanSecret ? (invertLogic ? 'lower' : 'higher') : (invertLogic ? 'higher' : 'lower')) as 'higher' | 'lower',
    arrow: isLessThanSecret ? '⬆️' : '⬇️'
  };
};

/**
 * Main organizational context wrapper that filters down eligible playable entries for the logic matrix.
 */
export const GuessWhoViewPage: React.FC<{ theme: GuessWhoTheme }> = ({ theme }) => {
  const playableEntities = useMemo<HydratedEntity[]>(() => {
    if (!theme.entities) return [];
    return theme.entities.filter(e => e.type.toLowerCase() === 'l4');
  }, [theme.entities]);

  return <GuessWhoGameEngine key={theme.id} theme={theme} availableEntities={playableEntities} />;
};

/**
 * Core runtime execution component managing target parameters, guess matrices, and delta states.
 */
const GuessWhoGameEngine: React.FC<{ theme: GuessWhoTheme; availableEntities: HydratedEntity[] }> = ({ theme, availableEntities }) => {
  const [secretEntity, setSecretEntity] = useState<HydratedEntity | null>(() => 
    availableEntities.length > 0 ? availableEntities[Math.floor(Math.random() * availableEntities.length)] : null
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [guesses, setGuesses] = useState<GuessRow[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  /**
   * Generates a new random target entity pointer and flushes form history loops.
   */
  const startNewGame = useCallback(() => {
    setSecretEntity(availableEntities[Math.floor(Math.random() * availableEntities.length)]);
    setGuesses([]);
    setGameOver(false);
    setSearchQuery('');
  }, [availableEntities]);

  /**
   * Builds an indexed timeline of source entity layers sorted cleanly by entry dates.
   */
  const getOrganizationDetails = useCallback((entity: HydratedEntity): { names: string[], hasEndDate: boolean[] } => {
    const orgLayerKey = theme.orgLayer || 'l3';
    
    const connections = entity.targetConnections?.filter(
      c => c.sourceEntity?.type.toLowerCase() === orgLayerKey.toLowerCase()
    ) || [];

    const parseDate = (dateStr?: string): Date => {
      if (!dateStr || typeof dateStr !== 'string') return new Date(8640000000000000); 
      const [d, m, y] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d);
    };

    const sortedConnections = [...connections].sort((a, b) => {
      const metaA = (a.metadata as OrgMetadata) || {};
      const metaB = (b.metadata as OrgMetadata) || {};
      return parseDate(metaA.startDate).getTime() - parseDate(metaB.startDate).getTime();
    });

    return { 
      names: sortedConnections.map(c => c.sourceEntity?.name || ''),
      hasEndDate: sortedConnections.map(c => !!(c.metadata as OrgMetadata)?.endDate)
    };
  }, [theme.orgLayer]);

  /**
   * Resolves total lifespan years or target age calculations from structured string inputs.
   */
  const getAgeFromDateString = useCallback((birthDateStr?: unknown, passingDateStr?: unknown): number => {
    if (typeof birthDateStr !== 'string') return 0;
    const [d, m, y] = birthDateStr.split('-').map(Number);
    if (!y) return 0;
    const birthDate = new Date(y, m - 1, d);
    let endDate = new Date();
    if (typeof passingDateStr === 'string') {
      const [pd, pm, py] = passingDateStr.split('-').map(Number);
      if (py) endDate = new Date(py, pm - 1, pd);
    }
    let age = endDate.getFullYear() - birthDate.getFullYear();
    if (endDate < new Date(endDate.getFullYear(), birthDate.getMonth(), birthDate.getDate())) age--;
    return age;
  }, []);

  /**
   * Compares the selected entry record against the target entity parameters to insert a new tracking row.
   */
  const handleSelectGuess = useCallback((guessedEntity: HydratedEntity): void => {
    if (!secretEntity || gameOver) return;

    const secretOrgData = getOrganizationDetails(secretEntity);
    const guessOrgData = getOrganizationDetails(guessedEntity);

    const isExactMatch = secretOrgData.names.length === guessOrgData.names.length && 
                         secretOrgData.names.every((val, index) => val === guessOrgData.names[index]);
    const hasPartialMatch = guessOrgData.names.some(name => secretOrgData.names.includes(name));
    const orgStatus = isExactMatch ? 'correct' : (hasPartialMatch ? 'partial' : 'incorrect');

    const displayOrg = guessOrgData.names.reduce((acc, name, i) => {
      if (i === 0) return name;
      const separator = guessOrgData.hasEndDate[i - 1] ? ' → ' : ' - ';
      return acc + separator + name;
    }, '');

    const sMeta = (secretEntity.metadata || {}) as Record<string, unknown>;
    const gMeta = (guessedEntity.metadata || {}) as Record<string, unknown>;

    const newRow: GuessRow = {
      entity: guessedEntity,
      displayOrg: displayOrg || 'Independent',
      checks: {
        name: guessedEntity.id === secretEntity.id ? 'correct' : 'incorrect',
        org: orgStatus,
        nationality: evaluateArrayMatch(parseMetaToCleanArray(gMeta.Nationality), parseMetaToCleanArray(sMeta.Nationality)),
        role: evaluateArrayMatch(parseMetaToCleanArray(gMeta.Role), parseMetaToCleanArray(sMeta.Role)),
        debut: evaluateNumericMetric(Number(gMeta.DebutYear || 0), Number(sMeta.DebutYear || 0)).check,
        age: evaluateNumericMetric(getAgeFromDateString(gMeta.Birthday, gMeta.PassingDate), getAgeFromDateString(sMeta.Birthday, sMeta.PassingDate)).check,
        height: evaluateNumericMetric(Number(gMeta.Height || 0), Number(sMeta.Height || 0), true).check,
      },
      arrows: {
        debut: evaluateNumericMetric(Number(gMeta.DebutYear || 0), Number(sMeta.DebutYear || 0)).arrow,
        age: evaluateNumericMetric(getAgeFromDateString(gMeta.Birthday, gMeta.PassingDate), getAgeFromDateString(sMeta.Birthday, sMeta.PassingDate)).arrow,
        height: evaluateNumericMetric(Number(gMeta.Height || 0), Number(sMeta.Height || 0), true).arrow
      }
    };

    setGuesses(prev => [newRow, ...prev]);
    setSearchQuery('');
    setShowDropdown(false);
    if (guessedEntity.id === secretEntity.id) setGameOver(true);
  }, [secretEntity, gameOver, getOrganizationDetails, getAgeFromDateString]);

  if (!secretEntity) return <div>Loading...</div>;

  return (
    <GuessWhoView
      theme={theme}
      secretEntity={secretEntity}
      searchQuery={searchQuery}
      guesses={guesses}
      gameOver={gameOver}
      showDropdown={showDropdown}
      filteredDropdownOptions={availableEntities.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()) && !guesses.some(g => g.entity.id === e.id)).slice(0, 8)}
      setSearchQuery={setSearchQuery}
      setShowDropdown={setShowDropdown}
      startNewGame={startNewGame}
      handleSelectGuess={handleSelectGuess}
      getAgeFromDateString={getAgeFromDateString}
    />
  );
};