import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Theme, HydratedEntity, BaseEntity, MetaDataStandard } from '../../types';
import { EntityCard } from '../../core/components/UI/PortalCard/EntityCard/EntityCard';
import styles from './LayerView.module.css';

interface ParentBucket {
  parent: BaseEntity;
  children: HydratedEntity[];
}

interface Props {
  theme: Theme;
}

const checkIsStandaloneByMetadata = (metadata: unknown, term: string): boolean => {
  if (!metadata || !term) return false;
  const lowerTerm = term.toLowerCase().trim();

  const scan = (value: unknown): boolean => {
    if (typeof value === 'string') {
      return value.toLowerCase().includes(lowerTerm);
    }
    if (Array.isArray(value)) {
      return value.some((item: unknown) => scan(item));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some((val: unknown) => scan(val));
    }
    return false;
  };

  return scan(metadata);
};

export const L4View: React.FC<Props> = ({ theme }) => {
  const navigate = useNavigate();
  const parentMap = new Map<string, ParentBucket>();

  const endpoints = theme.entities?.filter((e) => e.type === 'l4') || [];

  const layerStandard = useMemo(() => {
    if (!theme.layerMetadata) return undefined;
    if (typeof theme.layerMetadata === 'string') {
      try {
        const parsed = JSON.parse(theme.layerMetadata) as Record<string, MetaDataStandard | undefined>;
        return parsed['l4'];
      } catch (err) {
        console.log(err);
        return undefined;
      }
    }
    const record = theme.layerMetadata as Record<string, MetaDataStandard | undefined>;
    return record['l4'] || record['L4'];
  }, [theme.layerMetadata]);

  const triggers = layerStandard?.statusTriggers;
  const standaloneLabel = theme.labels['l4_standalone'] ?? 'Solo Career / Standalone';
  const inactiveLabel = theme.labels['disbanded_tag'] ?? 'Inactive / Historical';

  const standaloneSearchTerm = useMemo(() => {
    const rawLabel = theme.labels['l4_standalone'] || 'Solo';
    return rawLabel.split(' ')[0].toLowerCase();
  }, [theme.labels]);

  if (endpoints.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>✨</div>
        <h3>Geen data gevonden voor {theme.labels.l4 || 'Layer 4'}.</h3>
        <p>De dataset bevat geen entiteiten van het type "l4" voor "{theme.title}".</p>
      </div>
    );
  }

  const standaloneEntities = endpoints
    .filter((endpoint) => checkIsStandaloneByMetadata(endpoint.metadata, standaloneSearchTerm))
    .map((entity) => {
      const l4Status = (entity.status || '').toLowerCase().trim();
      const isDeceased = !!entity.metadata?.PassingDate;

      if (['retired', 'inactive'].includes(l4Status) || isDeceased) {
        return {
          ...entity,
          metadata: { ...(entity.metadata || {}), isFormer: true }
        };
      }
      return entity;
    });

  endpoints.forEach((l4Entity) => {
    const allConns = [...(l4Entity.connections || []), ...(l4Entity.targetConnections || [])];

    allConns.forEach((conn) => {
      const sourceEntity = conn.sourceEntity;
      const targetEntity = conn.targetEntity;

      let l3Entity: BaseEntity | null = null;
      if (sourceEntity?.type === 'l3') l3Entity = sourceEntity;
      else if (targetEntity?.type === 'l3') l3Entity = targetEntity;

      if (!l3Entity) return;

      const connectionStatus = (conn.metadata?.status || '').toLowerCase().trim();
      const parentStatus = (l3Entity.status || '').toLowerCase().trim();
      const l4Status = (l4Entity.status || '').toLowerCase().trim();
      const isDeceased = !!l4Entity.metadata?.PassingDate;

      const isFormerConnection =
        connectionStatus.includes('former') ||
        connectionStatus === 'ex' ||
        connectionStatus === 'retired' ||
        conn.metadata?.isFormer === true ||
        isDeceased;

      const isL4EntityInactive = ['retired', 'inactive'].includes(l4Status) || isDeceased;
      const isParentInactive = ['disbanded', 'inactive', 'retired', 'historical'].includes(parentStatus);
      const isParentActive = !isParentInactive;

      const autoHide = (isFormerConnection || isL4EntityInactive) && isParentActive;
      const isHidden = !isParentInactive && (conn.metadata?.hideFromGrid === true || autoHide);

      if (!isHidden) {
        if (!parentMap.has(l3Entity.id)) {
          parentMap.set(l3Entity.id, { parent: l3Entity, children: [] });
        }
        const bucket = parentMap.get(l3Entity.id)!;
        const enrichedMetadata = { ...(l4Entity.metadata || {}) };

        if (isFormerConnection) {
          enrichedMetadata.isFormer = true;
        }

        if (triggers && connectionStatus) {
          const matchedTriggerEntry = Object.entries(triggers).find(
            ([key]) => connectionStatus.includes(key.toLowerCase()) || key.toLowerCase().includes(connectionStatus)
          );

          if (matchedTriggerEntry) {
            const [triggerKey, triggerConfig] = matchedTriggerEntry;
            if (
              triggerConfig &&
              typeof triggerConfig === 'object' &&
              'key' in triggerConfig &&
              'value' in triggerConfig
            ) {
              enrichedMetadata[String(triggerConfig.key)] = String(triggerConfig.value);
            }

            if (triggerKey.toLowerCase() === 'hiatus') enrichedMetadata.isHiatus = true;
            if (['former', 'ex'].includes(triggerKey.toLowerCase())) enrichedMetadata.isFormer = true;
          }
        }

        enrichedMetadata.status = connectionStatus;

        const enrichedChild: HydratedEntity = {
          ...l4Entity,
          status: connectionStatus || l4Entity.status,
          metadata: enrichedMetadata
        };

        if (!bucket.children.some((c) => c.id === enrichedChild.id)) {
          bucket.children.push(enrichedChild);
        }
      }
    });
  });

  const allBuckets = Array.from(parentMap.values());
  const isInactiveStatus = (status: string) =>
    ['disbanded', 'inactive', 'retired', 'historical'].includes(status.toLowerCase().trim());

  const sortGroupChildren = (children: HydratedEntity[]) => {
    return [...children].sort((a, b) => a.name.localeCompare(b.name));
  };

  const activeBuckets = allBuckets
    .filter((b) => !isInactiveStatus(b.parent.status || ''))
    .sort((a, b) => a.parent.name.localeCompare(b.parent.name))
    .map(bucket => ({ ...bucket, children: sortGroupChildren(bucket.children) }));

  const inactiveBuckets = allBuckets
    .filter((b) => isInactiveStatus(b.parent.status || ''))
    .sort((a, b) => a.parent.name.localeCompare(b.parent.name))
    .map(bucket => ({ ...bucket, children: sortGroupChildren(bucket.children) }));

  standaloneEntities.sort((a, b) => a.name.localeCompare(b.name));

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
            {children.map((child, idx) => (
              <div
                key={`${parent.id}-${child.id}-${idx}`}
                onClick={() => navigate(`/${theme.id}/profile/${child.id}`)}
                className={styles.cardWrapper}
                style={{ animationDelay: `${idx * 0.04}s` }}
              >
                <EntityCard
                  entity={child}
                  activeKey="l4"
                  theme={theme}
                  labels={theme.labels}
                  organization={parent}
                  customLabel={theme.labels.l4}
                />
              </div>
            ))}
          </div>
        </section>
      ))}

      {standaloneEntities.length > 0 && (
        <section className={styles.groupCard}>
          <div className={styles.groupHeaderRow}>
            <h2 className={styles.groupHeader}>{standaloneLabel}</h2>
            <div className={styles.groupBadge}>
              <span className={styles.badgeDot} />
              {standaloneEntities.length} artiesten
            </div>
          </div>
          <div className={styles.cardGrid}>
            {standaloneEntities.map((standalone, idx) => (
              <div
                key={`standalone-${standalone.id}-${idx}`}
                onClick={() => navigate(`/${theme.id}/profile/${standalone.id}`)}
                className={styles.cardWrapper}
                style={{ animationDelay: `${idx * 0.04}s` }}
              >
                <EntityCard
                  entity={standalone}
                  activeKey="l4"
                  theme={theme}
                  labels={theme.labels}
                  customLabel={theme.labels.l4}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {inactiveBuckets.map(({ parent, children }) => (
        <section key={parent.id} className={`${styles.groupCard} ${styles.inactiveGroup}`}>
          <div className={styles.groupHeaderRow}>
            <h2 className={styles.groupHeader}>
              {parent.name} <span className={styles.subTag}>({inactiveLabel})</span>
            </h2>
            <div className={styles.groupBadgeInactive}>
              {children.length} leden
            </div>
          </div>
          <div className={styles.cardGrid}>
            {children.map((child, idx) => (
              <div
                key={`${parent.id}-${child.id}-${idx}`}
                onClick={() => navigate(`/${theme.id}/profile/${child.id}`)}
                className={styles.cardWrapper}
                style={{ animationDelay: `${idx * 0.04}s` }}
              >
                <EntityCard
                  entity={child}
                  activeKey="l4"
                  theme={theme}
                  labels={theme.labels}
                  organization={parent}
                  customLabel={theme.labels.l4}
                />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};