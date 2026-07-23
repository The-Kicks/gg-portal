import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Theme } from '../../types';
import { EntityCard } from '../../core/components/UI/PortalCard/EntityCard/EntityCard';
import styles from './LayerView.module.css';

interface Props {
  theme: Theme;
}

/**
 * L1View renders the root node tier elements of the overarching structural entity hierarchy.
 * Segregates target components dynamically by active or historical operations statuses.
 */
export const L1View: React.FC<Props> = ({ theme }) => {
  const navigate = useNavigate();

  const endpoints = theme.entities?.filter((e) => e.type === 'l1') || [];

  if (endpoints.length === 0) {
    return (
      <div className={styles.emptyState}>
        <h3>No data found for {theme.labels.l1 || 'Layer 1'}.</h3>
      </div>
    );
  }

  /**
   * Evaluates the operational lifecycle status flag of a given entity.
   */
  const isInactiveStatus = (status: string) =>
    ['disbanded', 'inactive', 'retired', 'historical', 'ex', 'former'].includes(status.toLowerCase().trim());

  const activeL1s = endpoints
    .filter((e) => !isInactiveStatus(e.status || ''))
    .sort((a, b) => a.name.localeCompare(b.name));

  const inactiveL1s = endpoints
    .filter((e) => isInactiveStatus(e.status || ''))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className={styles.layerContainer}>
      {activeL1s.length > 0 && (
        <section className={styles.groupCard}>
          <div className={styles.groupHeaderRow}>
            <h2 className={styles.groupHeader}>{theme.labels['l1_active'] ?? 'Active Global Alliances'}</h2>
            <div className={styles.groupBadge}>
              <span className={styles.badgeDot} />
              {activeL1s.length} items
            </div>
          </div>
          <div className={styles.cardGrid}>
            {activeL1s.map((conglomerate, idx) => (
              <div
                key={`l1-active-${conglomerate.id}-${idx}`}
                onClick={() => navigate(`/${theme.id}/structure/${conglomerate.id}`)}
                className={styles.cardWrapper}
                style={{ animationDelay: `${idx * 0.04}s` }}
              >
                <EntityCard entity={conglomerate} activeKey="l1" theme={theme} labels={theme.labels} />
              </div>
            ))}
          </div>
        </section>
      )}

      {inactiveL1s.length > 0 && (
        <section className={`${styles.groupCard} ${styles.inactiveGroup}`}>
          <div className={styles.groupHeaderRow}>
            <h2 className={styles.groupHeader}>
              {theme.labels['l1_historical'] ?? 'Historical / Merged Entities'}
            </h2>
            <div className={styles.groupBadgeInactive}>
              {inactiveL1s.length} items
            </div>
          </div>
          <div className={styles.cardGrid}>
            {inactiveL1s.map((conglomerate, idx) => {
              const isFormer = isInactiveStatus(conglomerate.status || '') || !!conglomerate.metadata?.PassingDate;
              const enrichedConglomerate = isFormer ? {
                ...conglomerate,
                metadata: { ...(conglomerate.metadata || {}), isFormer: true }
              } : conglomerate;

              return (
                <div
                  key={`l1-inactive-${conglomerate.id}-${idx}`}
                  onClick={() => navigate(`/${theme.id}/structure/${conglomerate.id}`)}
                  className={styles.cardWrapper}
                  style={{ animationDelay: `${idx * 0.04}s` }}
                >
                  <EntityCard entity={enrichedConglomerate} activeKey="l1" theme={theme} labels={theme.labels} />
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};