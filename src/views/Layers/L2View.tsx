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

export const L2View: React.FC<Props> = ({ theme }) => {
  const navigate = useNavigate();
  const parentMap = new Map<string, ParentBucket>();

  const endpoints = theme.entities?.filter((e) => e.type === 'l2') || [];

  if (endpoints.length === 0) {
    return (
      <div className={styles.emptyState}>
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
    ['disbanded', 'inactive', 'retired', 'historical', 'ex', 'former'].includes(status.toLowerCase().trim());

  const activeBuckets = allBuckets.filter((b) => !isInactiveStatus(b.parent.status || ''));
  const inactiveBuckets = allBuckets.filter((b) => isInactiveStatus(b.parent.status || ''));

  const checkIfFormer = (entity: HydratedEntity) => {
    const status = (entity.status || '').toLowerCase().trim();
    return ['disbanded', 'inactive', 'retired', 'historical', 'ex', 'former'].includes(status) || !!entity.metadata?.PassingDate;
  };

  return (
    <div className={styles.layerContainer}>
      {activeBuckets.map(({ parent, children }) => (
        <section key={parent.id} className={styles.groupCard}>
          <div className={styles.groupHeaderRow}>
            <h2 className={styles.groupHeader}>{parent.name}</h2>
            <div className={styles.groupBadge}>
              <span className={styles.badgeDot} />
              {children.length} leden
            </div>
          </div>
          <div className={styles.cardGrid}>
            {children.map((child, idx) => {
              const isFormer = checkIfFormer(child);
              const enrichedChild = isFormer ? {
                ...child,
                metadata: { ...(child.metadata || {}), isFormer: true }
              } : child;

              return (
                <div
                  key={`${parent.id}-${child.id}-${idx}`}
                  onClick={() => navigate(`/${theme.id}/structure/${child.id}`)}
                  className={styles.cardWrapper}
                  style={{ animationDelay: `${idx * 0.04}s` }}
                >
                  <EntityCard entity={enrichedChild} activeKey="l2" theme={theme} labels={theme.labels} organization={parent} />
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {standaloneEntities.length > 0 && (
        <section className={styles.groupCard}>
          <div className={styles.groupHeaderRow}>
            <h2 className={styles.groupHeader}>{theme.labels['l2_standalone'] ?? 'Independent Agencies'}</h2>
            <div className={styles.groupBadge}>
              <span className={styles.badgeDot} />
              {standaloneEntities.length} items
            </div>
          </div>
          <div className={styles.cardGrid}>
            {standaloneEntities.map((standalone, idx) => {
              const isFormer = checkIfFormer(standalone);
              const enrichedStandalone = isFormer ? {
                ...standalone,
                metadata: { ...(standalone.metadata || {}), isFormer: true }
              } : standalone;

              return (
                <div
                  key={`standalone-${standalone.id}-${idx}`}
                  onClick={() => navigate(`/${theme.id}/structure/${standalone.id}`)}
                  className={styles.cardWrapper}
                  style={{ animationDelay: `${idx * 0.04}s` }}
                >
                  <EntityCard entity={enrichedStandalone} activeKey="l2" theme={theme} labels={theme.labels} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {inactiveBuckets.map(({ parent, children }) => (
        <section key={parent.id} className={`${styles.groupCard} ${styles.inactiveGroup}`}>
          <div className={styles.groupHeaderRow}>
            <h2 className={styles.groupHeader}>
              {parent.name} <span className={styles.subTag}>({theme.labels['disbanded_tag'] ?? 'Defunct'})</span>
            </h2>
            <div className={styles.groupBadgeInactive}>
              {children.length} leden
            </div>
          </div>
          <div className={styles.cardGrid}>
            {children.map((child, idx) => {
              const isFormer = checkIfFormer(child);
              const enrichedChild = isFormer ? {
                ...child,
                metadata: { ...(child.metadata || {}), isFormer: true }
              } : child;

              return (
                <div
                  key={`${parent.id}-${child.id}-${idx}`}
                  onClick={() => navigate(`/${theme.id}/structure/${child.id}`)}
                  className={styles.cardWrapper}
                  style={{ animationDelay: `${idx * 0.04}s` }}
                >
                  <EntityCard entity={enrichedChild} activeKey="l2" theme={theme} labels={theme.labels} organization={parent} />
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};