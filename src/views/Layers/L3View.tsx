import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Theme, HydratedEntity, BaseEntity } from '../../types';
import { EntityCard } from '../../core/components/UI/PortalCard/EntityCard/EntityCard';
import styles from './LayerView.module.css';

interface Props {
  theme: Theme;
}

/**
 * L3View aggregates and renders Layer 3 operational working entities.
 * Resolves upstream structural graph links dynamically to attach corporate parent context.
 */
export const L3View: React.FC<Props> = ({ theme }) => {
  const navigate = useNavigate();
  const allEntities = theme.entities || [];

  const groups = allEntities.filter((e) => e.type === 'l3');

  if (groups.length === 0) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text)' }}>
        <h3>No data found for {theme.labels.l3 || 'Layer 3'}.</h3>
      </div>
    );
  }

  /**
   * Traverses structural connection vectors backward to determine the nearest upstream parent node.
   * Scans immediate preferred layers before falling back to multi-tier recursive path evaluation.
   */
  const findClosestParent = (entity: HydratedEntity, preferredTypes: string[]): BaseEntity | null => {
    const conns = [...(entity.connections || []), ...(entity.targetConnections || [])];

    for (const type of preferredTypes) {
      for (const conn of conns) {
        if (conn.sourceEntity?.type === type) return conn.sourceEntity;
        if (conn.targetEntity?.type === type) return conn.targetEntity;
      }
    }

    for (const conn of conns) {
      let intermediateId = '';
      if (conn.sourceEntity?.type === 'l2') intermediateId = conn.sourceEntity.id;
      else if (conn.targetEntity?.type === 'l2') intermediateId = conn.targetEntity.id;

      if (intermediateId) {
        const parentL2 = allEntities.find(e => e.id === intermediateId);
        if (parentL2) {
          const l2Conns = [...(parentL2.connections || []), ...(parentL2.targetConnections || [])];
          for (const l2Conn of l2Conns) {
            if (l2Conn.sourceEntity?.type === 'l1') return l2Conn.sourceEntity;
            if (l2Conn.targetEntity?.type === 'l1') return l2Conn.targetEntity;
          }
        }
      }
    }

    return null;
  };

  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className={styles.layerContainer}>
      <div className={styles.cardGrid}>
        {sortedGroups.map((group) => {
          const closestParent = findClosestParent(group, ['l2', 'l1']);

          const isDisbanded = ['disbanded', 'inactive', 'retired', 'historical'].includes(
            (group.status || '').toLowerCase().trim()
          );

          const cardClass = `${styles.cardWrapper} ${isDisbanded ? styles.isFormer : ''}`;

          return (
            <div
              key={group.id}
              onClick={() => navigate(`/${theme.id}/structure/${group.id}`)}
              className={cardClass}
            >
              <EntityCard 
                entity={group} 
                activeKey="l3" 
                theme={theme} 
                labels={theme.labels} 
                organization={closestParent || undefined}
                customLabel={theme.labels.l3}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};