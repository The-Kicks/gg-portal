import React, { useMemo } from 'react';
import type { Theme, HydratedEntity } from '../../../types';
import type { GuessRow } from './GuessWhoViewPage';
import styles from './GuessWho.module.css';

interface GuessWhoViewProps {
  // Uitgebreid met optionele spelinstellingen vanuit de database Json
  theme: Theme & {
    settings?: {
      guesswho?: {
        disabledColumns?: string[];
        ignoredMetadata?: string[];
      };
    };
  };
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (filteredDropdownOptions.length > 0) {
        e.preventDefault();
        handleSelectGuess(filteredDropdownOptions[0]);
      }
    }
  };

  /**
   * Safely formats nationalities. Returns '-' token if empty.
   */
  const renderNationalityCell = (entity: HydratedEntity): string => {
    // Als nationaliteit uitgeschakeld is in de instellingen, negeer deze dan direct
    if (theme.gameSettings?.guesswho?.disabledColumns?.includes('nationality')) return '-';

    const meta = (entity.metadata || {}) as Record<string, unknown>;
    if (Array.isArray(meta.Nationality)) {
      const list = meta.Nationality.map(n => String(n).trim()).filter(Boolean);
      return list.length > 0 ? list.join(', ') : '-';
    }
    return String(meta.Nationality || '').trim() || '-';
  };

  /**
   * General string parser checking for valid textual properties.
   */
  const renderMetadataString = (entity: HydratedEntity, key: string): string => {
    const ignoredMeta = (theme.gameSettings?.guesswho?.ignoredMetadata || []) as string[];
    if (ignoredMeta.includes(key)) return '-';

    const meta = (entity.metadata || {}) as Record<string, unknown>;
    return String(meta[key] || '').trim() || '-';
  };

  /**
   * Formats numeric metrics like Debut and Height cleanly without unit-spill glitches.
   */
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

  /**
   * DYNAMISCH KOLOMMEN BLUEPRINT
   * Filtert automatisch kolommen weg die in `theme.settings.disabledColumns` staan gedefinieerd.
   */
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

    const disabledList = (theme.gameSettings?.guesswho?.disabledColumns || []) as string[];
    return allColumns.filter(col => !disabledList.includes(col.id));
  }, [theme.labels, theme.gameSettings?.guesswho?.disabledColumns]);

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

              {/*  Genereer alleen th-koppen voor kolommen die niet verborgen zijn */}
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
                    // Definieer metadata veilig bovenaan
                    const meta = row.entity.metadata as Record<string, unknown> | undefined;

                    switch (col.id) {
                      case 'profile': {
                        return (
                          <td key={col.id} className={styles.cellProfile}>
                            <img src={getProfileImage(row.entity)} alt="" className={styles.tableAvatar} />
                          </td>
                        );
                      }
                      case 'name': {
                        return (
                          <td key={col.id} className={`${styles.cellBox} ${styles[row.checks.name]}`}>
                            {row.entity.name || '-'}
                          </td>
                        );
                      }
                      case 'org': {
                        return (
                          <td key={col.id} className={`${styles.cellBox} ${styles[row.checks.org]}`}>
                            {row.displayOrg || '-'}
                          </td>
                        );
                      }
                      case 'nationality': {
                        return (
                          <td key={col.id} className={`${styles.cellBox} ${styles[row.checks.nationality]}`}>
                            {renderNationalityCell(row.entity)}
                          </td>
                        );
                      }
                      case 'role': {
                        return (
                          <td key={col.id} className={`${styles.cellBox} ${styles[row.checks.role]}`}>
                            {renderMetadataString(row.entity, 'Role')}
                          </td>
                        );
                      }
                      case 'debut': {
                        return (
                          <td key={col.id} className={`${styles.cellBox} ${styles[row.checks.debut]}`}>
                            {renderNumericDisplay(meta?.DebutYear)} {row.arrows.debut}
                          </td>
                        );
                      }
                      case 'age': {
                        // Gebruik de 2 argumenten, TypeScript klaagt nu niet meer
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
                      case 'height': {
                        return (
                          <td key={col.id} className={`${styles.cellBox} ${styles[row.checks.height]}`}>
                            {renderNumericDisplay(meta?.Height, 'cm')} {row.arrows.height}
                          </td>
                        );
                      }
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