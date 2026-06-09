import React, { useMemo } from 'react';
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

interface GuessWhoViewProps {
  theme: GuessWhoTheme;
  secretEntity: HydratedEntity;
  searchQuery: string;
  guesses: GuessRow[];
  gameOver: boolean;
  showDropdown: boolean;
  filteredDropdownOptions: HydratedEntity[];
  setSearchQuery: (query: string) => void;
  setShowDropdown: (show: boolean) => void;
  startNewGame: () => void;
  handleSelectGuess: (entity: HydratedEntity) => void;
  getAgeFromDateString: (birthDateStr?: unknown, passingDateStr?: unknown) => number;
}

export const GuessWhoView: React.FC<GuessWhoViewProps> = ({
  theme,
  secretEntity,
  searchQuery,
  guesses,
  gameOver,
  showDropdown,
  filteredDropdownOptions,
  setSearchQuery,
  setShowDropdown,
  startNewGame,
  handleSelectGuess,
  getAgeFromDateString
}) => {
  console.log("LOG: disabledColumns in View:", theme?.gameSettings?.guesswho?.disabledColumns);
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (filteredDropdownOptions.length > 0) {
        e.preventDefault();
        handleSelectGuess(filteredDropdownOptions[0]);
      }
    }
  };

  /**
   * Vertaalt de nationaliteit naar vlaggen via pure string splitting (geen regex)
   */
  const renderNationalityCell = (entity: HydratedEntity): React.ReactNode => {
    const meta = (entity.metadata || {}) as Record<string, unknown>;
    let nationalities: string[] = [];

    const rawValue = meta.Nationality;
    if (Array.isArray(rawValue)) {
      nationalities = rawValue
        .flatMap(n => String(n).split(','))
        .flatMap(n => n.split('/'))
        .map(n => n.trim())
        .filter(Boolean);
    } else if (typeof rawValue === 'string') {
      nationalities = rawValue
        .split(',')
        .flatMap(n => n.split('/'))
        .map(n => n.trim())
        .filter(Boolean);
    } else if (rawValue) {
      nationalities = [String(rawValue).trim()];
    }

    if (nationalities.length === 0) return '-';

    return (
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
        {nationalities.map((nat, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }} title={nat}>
            <ReactCountryFlag
              countryCode={nat.toUpperCase()}
              svg
              style={{ width: '1.4em', height: '1em', borderRadius: '2px', objectFit: 'cover' }}
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
    const num = Number(value || 0);
    if (!num || isNaN(num)) return '-';
    return `${num}${suffix}`;
  };

  const getProfileImage = (entity: HydratedEntity): string => {
    const imgObj = entity.image as Record<string, unknown> | null;
    if (imgObj && typeof imgObj.profileCard === 'string') {
      return imgObj.profileCard;
    }
    return 'https://via.placeholder.com/50';
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
          <h2>🎉 Congratulations!</h2>
          <p>You correctly guessed <strong>{secretEntity.name}</strong>!</p>
          <button className={styles.actionBtn} onClick={startNewGame}>Play Again</button>
        </div>
      ) : (
        <div className={styles.searchWrapper}>
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
              {filteredDropdownOptions.map((e, index) => (
                <li key={e.id} className={styles.dropdownItem} onClick={() => handleSelectGuess(e)}>
                  <img src={getProfileImage(e)} alt="" className={styles.avatarMini} />
                  <div>
                    <div className={styles.dropName}>
                      {e.name}
                      {index === 0 && searchQuery && (
                        <span style={{ opacity: 0.4, fontSize: '11px', fontStyle: 'italic', marginLeft: '8px' }}>
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
      )}

      <div className={styles.tableResponsive}>
        <table className={styles.gameTable}>
          <thead>
            <tr>
              {activeColumns.map(col => (
                <th key={col.id}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {guesses.map((row, idx) => {
              return (
                <tr key={idx}>
                  {activeColumns.map(col => {
                    const meta = row.entity.metadata as Record<string, unknown> | undefined;

                    switch (col.id) {
                      case 'profile':
                        return (
                          <td key={col.id} className={styles.cellProfile}>
                            <img src={getProfileImage(row.entity)} alt="" className={styles.tableAvatar} />
                          </td>
                        );
                      case 'name':
                        return (
                          <td key={col.id} className={`${styles.cellBox} ${styles[row.checks.name]}`}>
                            {row.entity.name || '-'}
                          </td>
                        );
                      case 'org':
                        return (
                          <td key={col.id} className={`${styles.cellBox} ${styles[row.checks.org]}`}>
                            {row.displayOrg || '-'}
                          </td>
                        );
                      case 'nationality':
                        return (
                          <td key={col.id} className={`${styles.cellBox} ${styles[row.checks.nationality]}`}>
                            {renderNationalityCell(row.entity)}
                          </td>
                        );
                      case 'role':
                        return (
                          <td key={col.id} className={`${styles.cellBox} ${styles[row.checks.role]}`}>
                            {renderMetadataString(row.entity, 'Role')}
                          </td>
                        );
                      case 'debut':
                        return (
                          <td key={col.id} className={`${styles.cellBox} ${styles[row.checks.debut]}`}>
                            {renderNumericDisplay(meta?.DebutYear)} {row.arrows.debut}
                          </td>
                        );
                      case 'age': {
                        const ageVal = getAgeFromDateString(meta?.Birthday, meta?.PassingDate);
                        const hasPassingDate = !!meta?.PassingDate;

                        return (
                          <td key={col.id} className={`${styles.cellBox} ${styles[row.checks.age]}`}>
                            {meta?.Birthday ? (
                              <>
                                {ageVal} {row.arrows.age}
                                {hasPassingDate && <span title="Deceased"> 🕊️</span>}
                              </>
                            ) : '-'}
                          </td>
                        );
                      }
                      case 'height':
                        return (
                          <td key={col.id} className={`${styles.cellBox} ${styles[row.checks.height]}`}>
                            {renderNumericDisplay(meta?.Height, 'cm')} {row.arrows.height}
                          </td>
                        );
                      default:
                        return null;
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