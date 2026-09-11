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

const parseMetaToCleanArray = (value: unknown): string[] => {
  if (!value) return [];
  const rawString = Array.isArray(value) ? value.join('/') : String(value);
  return rawString
    .split(',')
    .flatMap(v => v.split('/'))
    .map(v => v.replace(/[-/_]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase())
    .filter(Boolean);
};

const ensureSpaceAfterComma = (value: unknown): string => {
  if (!value) return '-';
  const str = Array.isArray(value) ? value.join(', ') : String(value);
  if (!str.trim()) return '-';
  
  return str
    .split(',')
    .map(part => part.trimStart())
    .join(', ');
};

const evaluateArrayMatch = (guessArr: string[], secretArr: string[]): 'correct' | 'partial' | 'incorrect' => {
  if (guessArr.length === 0 || secretArr.length === 0) {
    return guessArr.length === secretArr.length ? 'correct' : 'incorrect';
  }

  // Sorteer beide arrays alfabetisch zodat de volgorde niet uitmaakt
  const sortedGuess = [...guessArr].sort();
  const sortedSecret = [...secretArr].sort();

  const isExact = sortedGuess.length === sortedSecret.length && 
    sortedGuess.every((item, index) => item === sortedSecret[index]);

  if (isExact) return 'correct';
  
  const hasAnyMatch = guessArr.some(guessItem => {
    if (secretArr.includes(guessItem)) return true;
    const guessSubTokens = guessItem.split(/\s+/);
    return secretArr.some(secretItem => {
      if (secretItem.includes(guessItem) || guessItem.includes(secretItem)) return true;
      const secretSubTokens = secretItem.split(/\s+/);
      return guessSubTokens.some(token => token.length > 2 && secretSubTokens.includes(token));
    });
  });

  return hasAnyMatch ? 'partial' : 'incorrect';
};

const evaluateNumericMetric = (guessNum: number, secretNum: number, invertLogic = false) => {
  if (!guessNum || !secretNum || guessNum === secretNum) return { check: 'correct' as const, arrow: '' };
  const isLessThanSecret = guessNum < secretNum;
  return {
    check: (isLessThanSecret ? (invertLogic ? 'lower' : 'higher') : (invertLogic ? 'higher' : 'lower')) as 'higher' | 'lower',
    arrow: isLessThanSecret ? '⬆️' : '⬇️'
  };
};

export const GuessWhoViewPage: React.FC<{ theme: GuessWhoTheme }> = ({ theme }) => {
  const playableEntities = useMemo<HydratedEntity[]>(() => {
    if (!theme.entities) return [];
    return theme.entities.filter(e => e.type.toLowerCase() === 'l4');
  }, [theme.entities]);

  return <GuessWhoGameEngine key={theme.id} theme={theme} availableEntities={playableEntities} />;
};

const GuessWhoGameEngine: React.FC<{ theme: GuessWhoTheme; availableEntities: HydratedEntity[] }> = ({ theme, availableEntities }) => {
  const [secretEntity, setSecretEntity] = useState<HydratedEntity | null>(() =>
    availableEntities.length > 0 ? availableEntities[Math.floor(Math.random() * availableEntities.length)] : null
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [guesses, setGuesses] = useState<GuessRow[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const startNewGame = useCallback(() => {
    setSecretEntity(availableEntities[Math.floor(Math.random() * availableEntities.length)]);
    setGuesses([]);
    setGameOver(false);
    setSearchQuery('');
  }, [availableEntities]);

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

const bestGuessedRow = useMemo((): GuessRow | null => {
    if (guesses.length === 0 || !secretEntity) return null;

    const secretOrgData = getOrganizationDetails(secretEntity);
    const secretDisplayOrg = secretOrgData.names.reduce((acc, name, i) => {
      if (i === 0) return name;
      const separator = secretOrgData.hasEndDate[i - 1] ? ' → ' : ' - ';
      return acc + separator + name;
    }, '') || 'Independent';

    const accumulated: GuessRow = {
      entity: secretEntity,
      displayOrg: '-',
      checks: {
        name: 'incorrect',
        org: 'incorrect',
        nationality: 'incorrect',
        role: 'incorrect',
        debut: 'incorrect',
        age: 'incorrect',
        height: 'incorrect',
      },
      arrows: { debut: '', age: '', height: '' }
    };

    let hasAnyCorrect = false;

    guesses.forEach(g => {
      if (!g.entity) return;

      // Controleer zowel echte pogingen als hint-rijen
      if (g.checks.name === 'correct') { accumulated.checks.name = 'correct'; hasAnyCorrect = true; }

      if (g.checks.org === 'correct') {
        accumulated.checks.org = 'correct';
        accumulated.displayOrg = secretDisplayOrg;
        hasAnyCorrect = true;
      } else if (accumulated.checks.org !== 'correct' && g.checks.org === 'partial' && g.entity.id !== 'hint-placeholder') {
        accumulated.checks.org = 'partial';
        accumulated.displayOrg = g.displayOrg;
      }

      if (g.checks.nationality === 'correct') { accumulated.checks.nationality = 'correct'; hasAnyCorrect = true; }
      else if (accumulated.checks.nationality !== 'correct' && g.checks.nationality === 'partial' && g.entity.id !== 'hint-placeholder') { accumulated.checks.nationality = 'partial'; }

      if (g.checks.role === 'correct') { accumulated.checks.role = 'correct'; hasAnyCorrect = true; }
      else if (accumulated.checks.role !== 'correct' && g.checks.role === 'partial' && g.entity.id !== 'hint-placeholder') { accumulated.checks.role = 'partial'; }

      if (g.checks.debut === 'correct') { accumulated.checks.debut = 'correct'; hasAnyCorrect = true; }
      if (g.checks.age === 'correct') { accumulated.checks.age = 'correct'; hasAnyCorrect = true; }
      if (g.checks.height === 'correct') { accumulated.checks.height = 'correct'; hasAnyCorrect = true; }
    });

    return hasAnyCorrect ? accumulated : null;
  }, [guesses, secretEntity, getOrganizationDetails]);

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

    const cleanedEntityMetadata = {
      ...gMeta,
      Nationality: ensureSpaceAfterComma(gMeta.Nationality),
      Role: ensureSpaceAfterComma(gMeta.Role),
    };

    const cleanedGuessedEntity: HydratedEntity = {
      ...guessedEntity,
      metadata: cleanedEntityMetadata,
    };

    const newRow: GuessRow = {
      entity: cleanedGuessedEntity,
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

  const handleGiveUp = useCallback((): void => {
    if (!secretEntity) return;
    handleSelectGuess(secretEntity);
  }, [secretEntity, handleSelectGuess]);

  const handleUseHint = useCallback((): void => {
    if (!secretEntity || gameOver) return;

    const currentCorrect = bestGuessedRow?.checks || {
      name: 'incorrect',
      org: 'incorrect',
      nationality: 'incorrect',
      role: 'incorrect',
      debut: 'incorrect',
      age: 'incorrect',
      height: 'incorrect',
    };

    const keys: Array<keyof typeof currentCorrect> = ['nationality', 'role', 'debut', 'age', 'height', 'org', 'name'];

    let uncorrectKeys = keys.filter(k => {
      if (currentCorrect[k] === 'correct') return false;
      
      const alreadyHasHintForField = guesses.some(g => {
        if (g.entity.id !== 'hint-placeholder') return false;
        if (k === 'name' && g.checks.name === 'correct') return true;
        if (k === 'org' && g.checks.org === 'correct') return true;
        if (k === 'nationality' && g.checks.nationality === 'correct') return true;
        if (k === 'role' && g.checks.role === 'correct') return true;
        if (k === 'debut' && g.checks.debut === 'correct') return true;
        if (k === 'age' && g.checks.age === 'correct') return true;
        if (k === 'height' && g.checks.height === 'correct') return true;
        return false;
      });

      return !alreadyHasHintForField;
    });

    if (uncorrectKeys.length === 0) return;

    if (uncorrectKeys.length > 2 && (uncorrectKeys.includes('org') || uncorrectKeys.includes('name'))) {
      uncorrectKeys = uncorrectKeys.filter(k => k !== 'org' && k !== 'name');
    } else if (uncorrectKeys.length === 2 && uncorrectKeys.includes('org') && uncorrectKeys.includes('name')) {
      uncorrectKeys = uncorrectKeys.filter(k => k !== 'name');
    }

    if (uncorrectKeys.length === 0) return;

    const targetKey = uncorrectKeys[Math.floor(Math.random() * uncorrectKeys.length)];

    const secretMeta = (secretEntity.metadata || {}) as Record<string, string | number | boolean | string[] | undefined>;
    const secretOrgData = getOrganizationDetails(secretEntity);
    const secretDisplayOrg = secretOrgData.names.reduce((acc, name, i) => {
      if (i === 0) return name;
      const separator = secretOrgData.hasEndDate[i - 1] ? ' → ' : ' - ';
      return acc + separator + name;
    }, '') || 'Independent';

    const placeholderEntity: HydratedEntity = {
      id: 'hint-placeholder',
      name: targetKey === 'name' ? secretEntity.name : '---',
      type: 'l4',
      themeId: theme.id,
      isStandalone: false,
      image: { profileCard: 'inline-lightbulb-svg', heroBanner: '' },
      metadata: {
        Nationality: targetKey === 'nationality' ? ensureSpaceAfterComma(secretMeta.Nationality) : '---',
        Role: targetKey === 'role' ? ensureSpaceAfterComma(secretMeta.Role) : '---',
        DebutYear: targetKey === 'debut' ? secretMeta.DebutYear : '---',
        Birthday: targetKey === 'age' ? secretMeta.Birthday : '---',
        Height: targetKey === 'height' ? secretMeta.Height : '---',
      }
    };

    const hintRow: GuessRow = {
      entity: placeholderEntity,
      displayOrg: targetKey === 'org' ? secretDisplayOrg : '---',
      checks: {
        name: targetKey === 'name' ? 'correct' : 'incorrect',
        org: targetKey === 'org' ? 'correct' : 'incorrect',
        nationality: targetKey === 'nationality' ? 'correct' : 'incorrect',
        role: targetKey === 'role' ? 'correct' : 'incorrect',
        debut: targetKey === 'debut' ? 'correct' : 'incorrect',
        age: targetKey === 'age' ? 'correct' : 'incorrect',
        height: targetKey === 'height' ? 'correct' : 'incorrect',
      },
      arrows: { debut: '', age: '', height: '' }
    };

    setGuesses(prev => [hintRow, ...prev]);
    setSearchQuery('');
    setShowDropdown(false);
  }, [secretEntity, gameOver, bestGuessedRow, guesses, getOrganizationDetails, theme.id]);

  if (!secretEntity) return <div>Loading...</div>;

  return (
    <GuessWhoView
      theme={theme}
      secretEntity={secretEntity}
      searchQuery={searchQuery}
      guesses={guesses}
      bestGuessedRow={bestGuessedRow}
      gameOver={gameOver}
      showDropdown={showDropdown}
      filteredDropdownOptions={availableEntities
        .filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()) && !guesses.some(g => g.entity.id === e.id))
        .slice(0, 8)
        .map(e => ({
          entity: e,
          displayOrg: getOrganizationDetails(e).names[0] || 'Independent'
        }))}
      setSearchQuery={setSearchQuery}
      setShowDropdown={setShowDropdown}
      startNewGame={startNewGame}
      handleSelectGuess={handleSelectGuess}
      handleGiveUp={handleGiveUp}
      handleUseHint={handleUseHint}
      getAgeFromDateString={getAgeFromDateString}
    />
  );
};