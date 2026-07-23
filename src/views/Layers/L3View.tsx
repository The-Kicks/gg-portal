import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Theme, HydratedEntity, BaseEntity } from '../../types';
import { EntityCard } from '../../core/components/UI/PortalCard/EntityCard/EntityCard';
import styles from './LayerView.module.css';

interface Props {
  theme: Theme;
}

export const L3View: React.FC<Props> = ({ theme }) => {
  const navigate = useNavigate();
  const allEntities = theme.entities || [];

  const groups = allEntities.filter((e) => e.type === 'l3');

  if (groups.length === 0) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text)' }}>
        <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>No data found for {theme.labels.l3 || 'Layer 3'}.</h3>
      </div>
    );
  }

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
      <section className={styles.groupCard}>
        <div className={styles.groupHeaderRow}>
          <h2 className={styles.groupHeader}>{theme.labels.l3 || 'Layer 3'}</h2>
          <div className={styles.groupBadge}>
            <span className={styles.badgeDot} />
            {sortedGroups.length} items
          </div>
        </div>
        <div className={styles.cardGrid}>
          {sortedGroups.map((group, idx) => {
            const closestParent = findClosestParent(group, ['l2', 'l1']);

            const groupStatus = (group.status || '').toLowerCase().trim();
            const isDeceased = !!group.metadata?.PassingDate;
            const isDisbanded = ['disbanded', 'inactive', 'retired', 'historical', 'ex', 'former'].includes(groupStatus) || isDeceased;

            const enrichedGroup = isDisbanded ? {
              ...group,
              metadata: { ...(group.metadata || {}), isFormer: true }
            } : group;

            return (
              <div
                key={group.id}
                onClick={() => navigate(`/${theme.id}/structure/${group.id}`)}
                className={styles.cardWrapper}
                style={{ animationDelay: `${idx * 0.04}s` }}
              >
                <EntityCard 
                  entity={enrichedGroup} 
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
      </section>
    </div>
  );
};