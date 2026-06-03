import { useNavigate } from 'react-router-dom';
import type { Theme } from '../../types';
import { EntityCard } from '../../core/components/UI/PortalCard/EntityCard/EntityCard';
import styles from './LayerView.module.css';

interface Props {
  theme: Theme;
}

/**
 * L1View displays the absolute peak roots apex of the data network tree structure.
 * Analogy: Ultimate Governing Bodies, Media Tech Empires, or Parent Conglomerates 
 * (e.g., FIA, Liberty Media, HYBE, Kakao Entertainment).
 */
export const L1View: React.FC<Props> = ({ theme }) => {
  const navigate = useNavigate();

  // Filters down the master dataset array to exclusively catch Level 1 corporate parent entities
  const endpoints = theme.entities?.filter((e) => e.type === 'l1') || [];

  // Guard Clause: Renders a friendly empty notification state if no L1 data tags exist
  if (endpoints.length === 0) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text)' }}>
        <h3>Geen data gevonden voor {theme.labels.l1 || 'Laag 1'}. 🛑</h3>
      </div>
    );
  }

  // Utility checking helper function to identify historical or dissolved operational statuses
  const isInactiveStatus = (status: string) =>
    ['disbanded', 'inactive', 'retired', 'historical'].includes(status.toLowerCase().trim());

  // Segregates and alphabetically sorts active governing alliances profiles
  const activeL1s = endpoints
    .filter((e) => !isInactiveStatus(e.status || ''))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Segregates and alphabetically sorts inactive or merged legacy parent entities
  const inactiveL1s = endpoints
    .filter((e) => isInactiveStatus(e.status || ''))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className={styles.layerContainer}>
      {/* SECTION 1: Active Governing Titans / Parent Empires */}
      {activeL1s.length > 0 && (
        <div className={styles.groupSection}>
          <h2 className={styles.groupHeader}>{theme.labels['l1_active'] ?? 'Active Global Alliances'}</h2>
          <div className={styles.cardGrid}>
            {activeL1s.map((conglomerate, idx) => (
              <div
                key={`l1-active-${conglomerate.id}-${idx}`}
                onClick={() => navigate(`/${theme.id}/structure/${conglomerate.id}`)}
                className={styles.cardWrapper}
              >
                <EntityCard entity={conglomerate} activeKey="l1" theme={theme} labels={theme.labels} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 2: Historical Entities / Dissolved Parent Companies */}
      {inactiveL1s.length > 0 && (
        <div className={styles.groupSection}>
          <h2 className={styles.groupHeader}>
            {theme.labels['l1_historical'] ?? 'Historical / Merged Entities'}
          </h2>
          <div className={styles.cardGrid}>
            {inactiveL1s.map((conglomerate, idx) => (
              <div
                key={`l1-inactive-${conglomerate.id}-${idx}`}
                onClick={() => navigate(`/${theme.id}/structure/${conglomerate.id}`)}
                className={styles.cardWrapper}
              >
                <EntityCard entity={conglomerate} activeKey="l1" theme={theme} labels={theme.labels} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};