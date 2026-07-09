import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Theme, HydratedEntity, BaseEntity } from '../../types';
import { EntityCard } from '../../core/components/UI/PortalCard/EntityCard/EntityCard';
import styles from './LayerView.module.css';

interface ParentBucket {
  parent: BaseEntity;
  children: HydratedEntity[];
}

interface Props {
  theme: Theme;
}

/**
 * L2View maps, aggregates, and renders Layer 2 subsidiary nodes 
 * nested inside their corresponding Layer 1 parent entities.
 */
export const L2View: React.FC<Props> = ({ theme }) => {
  const navigate = useNavigate();
  const parentMap = new Map<string, ParentBucket>();

  const endpoints = theme.entities?.filter((e) => e.type === 'l2') || [];

  if (endpoints.length === 0) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text)' }}>
        <h3>No data found for {theme.labels.l2 || 'Layer 2'}.</h3>
      </div>
    );
  }

  const standaloneEntities = endpoints.filter((endpoint) => endpoint.isStandalone);

  endpoints.forEach((l2Entity) => {
    const allConns = [...(l2Entity.connections || []), ...(l2Entity.targetConnections || [])];

    allConns.forEach((conn) => {
      const sourceEntity = conn.sourceEntity;
      const targetEntity = conn.targetEntity;

      let l1Entity: BaseEntity | null = null;
      if (sourceEntity?.type === 'l1') l1Entity = sourceEntity;
      else if (targetEntity?.type === 'l1') l1Entity = targetEntity;

      if (!l1Entity) return;

      if (conn.metadata?.hideFromGrid !== true) {
        if (!parentMap.has(l1Entity.id)) {
          parentMap.set(l1Entity.id, { parent: l1Entity, children: [] });
        }
        const bucket = parentMap.get(l1Entity.id)!;
        if (!bucket.children.some((c) => c.id === l2Entity.id)) {
          bucket.children.push(l2Entity);
        }
      }
    });
  });

  const allBuckets = Array.from(parentMap.values());
  const isInactiveStatus = (status: string) =>
    ['disbanded', 'inactive', 'retired', 'historical'].includes(status.toLowerCase().trim());

  const activeBuckets = allBuckets.filter((b) => !isInactiveStatus(b.parent.status || ''));
  const inactiveBuckets = allBuckets.filter((b) => isInactiveStatus(b.parent.status || ''));

  return (
    <div className={styles.layerContainer}>
      {activeBuckets.map(({ parent, children }) => (
        <div key={parent.id} className={styles.groupSection}>
          <h2 className={styles.groupHeader}>{parent.name}</h2>
          <div className={styles.cardGrid}>
            {children.map((child, idx) => (
              <div
                key={`${parent.id}-${child.id}-${idx}`}
                onClick={() => navigate(`/${theme.id}/structure/${child.id}`)}
                className={styles.cardWrapper}
              >
                <EntityCard entity={child} activeKey="l2" theme={theme} labels={theme.labels} organization={parent} />
              </div>
            ))}
          </div>
        </div>
      ))}

      {standaloneEntities.length > 0 && (
        <div className={styles.groupSection}>
          <h2 className={styles.groupHeader}>{theme.labels['l2_standalone'] ?? 'Independent Agencies'}</h2>
          <div className={styles.cardGrid}>
            {standaloneEntities.map((standalone, idx) => (
              <div
                key={`standalone-${standalone.id}-${idx}`}
                onClick={() => navigate(`/${theme.id}/structure/${standalone.id}`)}
                className={styles.cardWrapper}
              >
                <EntityCard entity={standalone} activeKey="l2" theme={theme} labels={theme.labels} />
              </div>
            ))}
          </div>
        </div>
      )}

      {inactiveBuckets.map(({ parent, children }) => (
        <div key={parent.id} className={styles.groupSection}>
          <h2 className={styles.groupHeader}>{parent.name} ({theme.labels['disbanded_tag'] ?? 'Defunct'})</h2>
          <div className={styles.cardGrid}>
            {children.map((child, idx) => (
              <div
                key={`${parent.id}-${child.id}-${idx}`}
                onClick={() => navigate(`/${theme.id}/structure/${child.id}`)}
                className={styles.cardWrapper}
              >
                <EntityCard entity={child} activeKey="l2" theme={theme} labels={theme.labels} organization={parent} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};