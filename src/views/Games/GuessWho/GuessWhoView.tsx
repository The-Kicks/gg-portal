import React, { useMemo, useEffect, useRef } from 'react';
import ReactCountryFlag from 'react-country-flag';
import type { Theme, HydratedEntity } from '../../../types';
import type { GuessRow } from './GuessWhoViewPage';
import styles from './GuessWho.module.css';

export type GuessWhoTheme = Theme & {
  title?: string;
  orgLayer?: string;
  labels?: {
    l3?: string;
    l4?: string;
    Role?: string;
    DebutYear?: string;
  };
  gameSettings?: {
    guesswho?: {
      disabledColumns?: string[];
      ignoredMetadata?: string[];
    };
  };
};

export interface DropdownOption {
  entity: HydratedEntity;
  displayOrg: string;
}

interface GuessWhoViewProps {
  theme: GuessWhoTheme;
  secretEntity: HydratedEntity;
  searchQuery: string;
  guesses: GuessRow[];
  bestGuessedRow: GuessRow | null;
  gameOver: boolean;
  showDropdown: boolean;
  filteredDropdownOptions: DropdownOption[];
  setSearchQuery: (query: string) => void;
  setShowDropdown: (show: boolean) => void;
  startNewGame: () => void;
  handleSelectGuess: (entity: HydratedEntity) => void;
  handleGiveUp: () => void;
  handleUseHint: () => void;
  getAgeFromDateString: (birthDateStr?: unknown, passingDateStr?: unknown) => number;
}

export const GuessWhoView: React.FC<GuessWhoViewProps> = ({
  theme,
  secretEntity,
  searchQuery,
  guesses,
  bestGuessedRow,
  gameOver,
  showDropdown,
  filteredDropdownOptions,
  setSearchQuery,
  setShowDropdown,
  startNewGame,
  handleSelectGuess,
  handleGiveUp,
  handleUseHint,
  getAgeFromDateString
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setShowDropdown]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (filteredDropdownOptions.length > 0) {
        e.preventDefault();
        handleSelectGuess(filteredDropdownOptions[0].entity);
        setShowDropdown(false);
      }
    }
  };

  const isVideoFile = (filePath: string): boolean => {
    return typeof filePath === 'string' && /\.(mp4|webm|ogg|mov|gifv)(\?.*)?$|data:image\/svg\+xml/i.test(filePath);
  };

  const renderNationalityCell = (entity: HydratedEntity): React.ReactNode => {
    const meta = (entity.metadata || {}) as Record<string, unknown>;
    let nationalities: string[] = [];

    const rawValue = meta.Nationality;
    if (Array.isArray(rawValue)) {
      nationalities = rawValue.flatMap(n => String(n).split(',')).flatMap(n => n.split('/')).map(n => n.trim()).filter(Boolean);
    } else if (typeof rawValue === 'string') {
      nationalities = rawValue.split(',').flatMap(n => n.split('/')).map(n => n.trim()).filter(Boolean);
    } else if (rawValue) {
      nationalities = [String(rawValue).trim()];
    }

    if (nationalities.length === 0 || nationalities.includes('---')) return '---';

    return (
      <div className={styles.nationalityFlex}>
        {nationalities.map((nat, i) => (
          <span key={i} className={styles.nationalityItem} title={nat}>
            <ReactCountryFlag
              countryCode={nat.toUpperCase()}
              svg
              className={styles.flagIcon}
            />
            <span>{nat}</span>
          </span>
        ))}
      </div>
    );
  };

  const renderMetadataString = (entity: HydratedEntity, key: string): string => {
    const ignoredMeta = theme.gameSettings?.guesswho?.ignoredMetadata || [];
    if (ignoredMeta.includes(key)) return '-';
    const meta = (entity.metadata || {}) as Record<string, unknown>;
    return String(meta[key] || '').trim() || '-';
  };

  const renderNumericDisplay = (value: unknown, suffix = ''): string => {
    if (value === '---') return '---';
    const num = Number(value || 0);
    if (!num || isNaN(num)) return '-';
    return `${num}${suffix}`;
  };

  const getProfileImage = (entity: HydratedEntity): string => {
    const imgObj = entity.image as Record<string, unknown> | null;
    return (imgObj && typeof imgObj.profileCard === 'string') ? imgObj.profileCard : 'https://via.placeholder.com/50';
  };

  const renderProfileMedia = (entity: HydratedEntity, className: string): React.ReactNode => {
    const profileUrl = getProfileImage(entity);
    if (profileUrl === 'inline-lightbulb-svg') {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#eab308" className={className}>
          <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7M9 21a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-1H9v1z"/>
        </svg>
      );
    }
    if (isVideoFile(profileUrl)) {
      return (
        <video
          src={profileUrl}
          autoPlay
          loop
          muted
          playsInline
          className={className}
        />
      );
    }
    return <img src={profileUrl} alt="" className={className} />;
  };

  const activeColumns = useMemo(() => {
    const allColumns = [
      { id: 'profile', label: 'Profile' },
      { id: 'name', label: 'Name' },
      { id: 'org', label: theme.labels?.l3 || 'Club/Team' },
      { id: 'nationality', label: 'Nationality' },
      { id: 'role', label: theme.labels?.Role || 'Role' },
      { id: 'debut', label: theme.labels?.DebutYear || 'Debut' },
      { id: 'age', label: 'Age' },
      { id: 'height', label: 'Height' },
    ];
    const rawDisabled = theme?.gameSettings?.guesswho?.disabledColumns;
    const disabledList = Array.isArray(rawDisabled) ? rawDisabled.map(s => String(s).trim().toLowerCase()) : [];
    return allColumns.filter(col => !disabledList.includes(col.id.toLowerCase()));
  }, [theme]);

  const isHintPlaceholder = (entity: HydratedEntity) => entity.id === 'hint-placeholder';

  return (
    <div className={styles.container}>
      <div className={styles.headerBox}>
        <h1 className={styles.title}>{theme.title}dle 🎯</h1>
        <p className={styles.subtitle}>
          Guess the hidden {theme.labels?.l4 || 'individual'} inside <strong>{theme.title}</strong>!
        </p>
      </div>

      {gameOver ? (
        <div className={styles.victoryCard}>
          {renderProfileMedia(secretEntity, styles.victoryAvatar)}
          <h2>🎉 Game Over</h2>
          <p>The hidden {theme.labels?.l4 || 'individual'} was <strong>{secretEntity.name}</strong>!</p>
          <button className={styles.actionBtn} onClick={startNewGame}>Play Again</button>
        </div>
      ) : null}

      {/* ACCUMULATED HINTS ROW */}
      {bestGuessedRow && guesses.length > 0 && (
        <div className={styles.bestRowContainer}>
          <div className={styles.bestRowTitle}>🎯 Accumulated Correct Hints:</div>
          <div className={styles.tableResponsive}>
            <table className={`${styles.gameTable} ${styles.bestRowTable}`}>
              <colgroup>
                {activeColumns.map(col => (
                  <col key={col.id} className={styles[`col_${col.id}`]} />
                ))}
              </colgroup>
              <tbody>
                <tr className={styles.highlightRow}>
                  {activeColumns.map(col => {
                    const sMeta = secretEntity.metadata as Record<string, unknown> | undefined;
                    switch (col.id) {
                      case 'profile': return <td key={col.id} className={styles.cellProfile}>-</td>;
                      case 'name': {
                        const isCorrect = bestGuessedRow.checks.name === 'correct';
                        return (
                          <td key={col.id} className={`${styles.cellBox} ${isCorrect ? styles.correct : styles.hintCell}`}>
                            {isCorrect ? secretEntity.name : '-'}
                          </td>
                        );
                      }
                      case 'org': {
                        const isCorrect = bestGuessedRow.checks.org === 'correct';
                        return (
                          <td key={col.id} className={`${styles.cellBox} ${isCorrect ? styles.correct : styles.hintCell}`}>
                            {isCorrect ? bestGuessedRow.displayOrg : '-'}
                          </td>
                        );
                      }
                      case 'nationality': {
                        const isCorrect = bestGuessedRow.checks.nationality === 'correct';
                        return (
                          <td key={col.id} className={`${styles.cellBox} ${isCorrect ? styles.correct : styles.hintCell}`}>
                            {isCorrect ? renderNationalityCell(secretEntity) : '-'}
                          </td>
                        );
                      }
                      case 'role': {
                        const isCorrect = bestGuessedRow.checks.role === 'correct';
                        return (
                          <td key={col.id} className={`${styles.cellBox} ${isCorrect ? styles.correct : styles.hintCell}`}>
                            {isCorrect ? renderMetadataString(secretEntity, 'Role') : '-'}
                          </td>
                        );
                      }
                      case 'debut': {
                        const isCorrect = bestGuessedRow.checks.debut === 'correct';
                        return (
                          <td key={col.id} className={`${styles.cellBox} ${isCorrect ? styles.correct : styles.hintCell}`}>
                            {isCorrect ? renderNumericDisplay(sMeta?.DebutYear) : '-'}
                          </td>
                        );
                      }
                      case 'age': { 
                        const isCorrect = bestGuessedRow.checks.age === 'correct';
                        const ageVal = getAgeFromDateString(sMeta?.Birthday, sMeta?.PassingDate);
                        return (
                          <td key={col.id} className={`${styles.cellBox} ${isCorrect ? styles.correct : styles.hintCell}`}>
                            {isCorrect && sMeta?.Birthday ? `${ageVal}` : '-'}
                          </td>
                        );
                      }
                      case 'height': {
                        const isCorrect = bestGuessedRow.checks.height === 'correct';
                        return (
                          <td key={col.id} className={`${styles.cellBox} ${isCorrect ? styles.correct : styles.hintCell}`}>
                            {isCorrect ? renderNumericDisplay(sMeta?.Height, 'cm') : '-'}
                          </td>
                        );
                      }
                      default: return null;
                    }
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SEARCH, DROPDOWN & ACTION BUTTONS IN ONE FLEX ROW */}
      {!gameOver && (
        <div className={styles.searchAndButtonsContainer}>
          <div className={styles.searchWrapper} ref={containerRef}>
            <input
              type="text"
              className={styles.searchBar}
              placeholder={`Search and guess ${theme.labels?.l4 || 'individuals'}...`}
              value={searchQuery}
              onFocus={() => setShowDropdown(true)}
              onChange={e => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onKeyDown={handleKeyDown}
            />
            {showDropdown && filteredDropdownOptions.length > 0 && (
              <ul className={styles.dropdown}>
                {filteredDropdownOptions.map((item, index) => (
                  <li key={item.entity.id} className={styles.dropdownItem} onClick={() => {
                    handleSelectGuess(item.entity);
                    setShowDropdown(false);
                  }}>
                    {renderProfileMedia(item.entity, styles.avatarDropdown)}
                    <div className={styles.dropInfo}>
                      <div className={styles.dropName}>
                        {item.entity.name} <span className={styles.dropOrg}>({item.displayOrg})</span>
                        {index === 0 && searchQuery && (
                          <span className={styles.enterTabHint}>
                            (Press Enter/Tab)
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={styles.actionButtonsWrapper}>
            <button className={`${styles.actionBtn} ${styles.hintBtnColor}`} onClick={handleUseHint}>
              💡 Hint
            </button>
            <button className={`${styles.actionBtn} ${styles.giveUpBtnColor}`} onClick={handleGiveUp}>
              🏳️ Give up
            </button>
          </div>
        </div>
      )}

      <div className={styles.tableResponsive}>
        <table className={styles.gameTable}>
          <colgroup>
            {activeColumns.map(col => (
              <col key={col.id} className={styles[`col_${col.id}`]} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {activeColumns.map(col => <th key={col.id}>{col.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {guesses.map((row, idx) => {
              const isHint = isHintPlaceholder(row.entity);

              return (
                <tr key={idx}>
                  {activeColumns.map(col => {
                    const meta = row.entity.metadata as Record<string, unknown> | undefined;
                    
                    switch (col.id) {
                      case 'profile': 
                        return (
                          <td key={col.id} className={styles.cellProfile}>
                            {renderProfileMedia(row.entity, styles.tableAvatar)}
                          </td>
                        );
                      case 'name': {
                        const val = row.entity.name || '-';
                        const cls = isHint 
                          ? (row.checks.name === 'correct' ? styles.correct : styles.hintCell) 
                          : styles[row.checks.name];
                        return <td key={col.id} className={`${styles.cellBox} ${cls}`}>{val}</td>;
                      }
                      case 'org': {
                        const val = row.displayOrg || '-';
                        const cls = isHint 
                          ? (row.checks.org === 'correct' ? styles.correct : styles.hintCell) 
                          : styles[row.checks.org];
                        return <td key={col.id} className={`${styles.cellBox} ${cls}`}>{val}</td>;
                      }
                      case 'nationality': {
                        const cellContent = renderNationalityCell(row.entity);
                        const cls = isHint 
                          ? (row.checks.nationality === 'correct' ? styles.correct : styles.hintCell) 
                          : styles[row.checks.nationality];
                        return <td key={col.id} className={`${styles.cellBox} ${cls}`}>{cellContent}</td>;
                      }
                      case 'role': {
                        const val = renderMetadataString(row.entity, 'Role');
                        const cls = isHint 
                          ? (row.checks.role === 'correct' ? styles.correct : styles.hintCell) 
                          : styles[row.checks.role];
                        return <td key={col.id} className={`${styles.cellBox} ${cls}`}>{val}</td>;
                      }
                      case 'debut': {
                        const val = renderNumericDisplay(meta?.DebutYear);
                        const cls = isHint 
                          ? (row.checks.debut === 'correct' ? styles.correct : styles.hintCell) 
                          : styles[row.checks.debut];
                        return <td key={col.id} className={`${styles.cellBox} ${cls}`}>{val} {row.arrows.debut}</td>;
                      }
                      case 'age': { 
                        const ageVal = getAgeFromDateString(meta?.Birthday, meta?.PassingDate);
                        const hasPassingDate = !!meta?.PassingDate;
                        const hasValidBday = meta?.Birthday && meta.Birthday !== '---';
                        const cls = isHint 
                          ? (row.checks.age === 'correct' ? styles.correct : styles.hintCell) 
                          : styles[row.checks.age];

                        return (
                          <td key={col.id} className={`${styles.cellBox} ${cls}`}>
                            {hasValidBday ? (
                              <>
                                {ageVal} {row.arrows.age}
                                {hasPassingDate && <span title="Deceased"> 🕊️</span>}
                              </>
                            ) : '---'}
                          </td>
                        );
                      }
                      case 'height': {
                        const val = renderNumericDisplay(meta?.Height, 'cm');
                        const cls = isHint 
                          ? (row.checks.height === 'correct' ? styles.correct : styles.hintCell) 
                          : styles[row.checks.height];
                        return <td key={col.id} className={`${styles.cellBox} ${cls}`}>{val} {row.arrows.height}</td>;
                      }
                      default: return null;
                    }
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};