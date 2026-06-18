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

/**
 * Type-safe helperfunctie om diep door de metadata te zoeken naar het standalone trefwoord.
 * Maakt gebruik van 'unknown' en runtime typeguards in plaats van 'any'.
 */
const checkIsStandaloneByMetadata = (metadata: unknown, term: string): boolean => {
  if (!metadata || !term) return false;
  const lowerTerm = term.toLowerCase().trim();

  const scan = (value: unknown): boolean => {
    // 1. Check op strings
    if (typeof value === 'string') {
      return value.toLowerCase().includes(lowerTerm);
    }
    
    // 2. Check op Arrays
    if (Array.isArray(value)) {
      return value.some((item: unknown) => scan(item));
    }
    
    // 3. Check op Objecten (zoals customTracks)
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

  // Alle L4 entiteiten ophalen
  const endpoints = theme.entities?.filter((e) => e.type === 'l4') || [];

  /**
   * Dynamic Status Trigger Scanner
   */
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

  // Labels configureren vanuit het thema
  const standaloneLabel = theme.labels['l4_standalone'] ?? 'Solo Career / Standalone';
  const inactiveLabel = theme.labels['disbanded_tag'] ?? 'Inactive / Historical';

  // Bepaal de zoekterm op basis van het label (bijv. "Solo acts" -> "solo")
  const standaloneSearchTerm = useMemo(() => {
    const rawLabel = theme.labels['l4_standalone'] || 'Solo';
    return rawLabel.split(' ')[0].toLowerCase();
  }, [theme.labels]);

  if (endpoints.length === 0) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text)' }}>
        <h3>Geen data gevonden voor {theme.labels.l4 || 'Laag 4'}. 🛑</h3>
        <p style={{ opacity: 0.6, fontSize: '0.9rem', marginTop: '0.5rem' }}>
          De dataset bevat geen entiteiten met type "l4" voor "{theme.title}".
        </p>
      </div>
    );
  }

  // 🛡️ DYNAMISCHE STANDALONE FILTERING: Nu volledig type-safe aangeroepen
  const standaloneEntities = endpoints
    .filter((endpoint) => checkIsStandaloneByMetadata(endpoint.metadata, standaloneSearchTerm))
    .map((entity) => {
      const l4Status = (entity.status || '').toLowerCase().trim();
      const isDeceased = !!entity.metadata?.PassingDate;
      
      if (['retired', 'inactive'].includes(l4Status) || isDeceased) {
        return {
          ...entity,
          metadata: {
            ...(entity.metadata || {}),
            isFormer: true
          }
        };
      }
      return entity;
    });

  // MAPPING ANALYSIS SYSTEM: Verwerkt relaties met L3 groepen
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

        if (isFormerConnection && triggers) {
          const formerTriggerEntry = Object.entries(triggers).find(
            ([key]) => key.toLowerCase() === 'former'
          );

          if (formerTriggerEntry) {
            const [, triggerConfig] = formerTriggerEntry;
            if (triggerConfig && typeof triggerConfig === 'object' && triggerConfig !== null && 'key' in triggerConfig && 'value' in triggerConfig) {
              enrichedMetadata[String(triggerConfig.key)] = String(triggerConfig.value);
            }
          }
        }

        const enrichedChild: HydratedEntity = {
          ...l4Entity,
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
    return [...children].sort((a, b) => {
      const roleA = String(a.metadata?.role || '').toLowerCase();
      const roleB = String(b.metadata?.role || '').toLowerCase();
      const isReserveA = roleA.includes('reserve') || roleA.includes('test');
      const isReserveB = roleB.includes('reserve') || roleB.includes('test');

      if (isReserveA && !isReserveB) return 1;
      if (!isReserveA && isReserveB) return -1;
      return a.name.localeCompare(b.name);
    });
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
      {/* SECTION 1: Active Groups / Teams */}
      {activeBuckets.map(({ parent, children }) => (
        <div key={parent.id} className={styles.groupSection}>
          <h2 className={styles.groupHeader}>{parent.name}</h2>
          <div className={styles.cardGrid}>
            {children.map((child, idx) => (
              <div
                key={`${parent.id}-${child.id}-${idx}`}
                onClick={() => navigate(`/${theme.id}/profile/${child.id}`)}
                className={styles.cardWrapper}
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
        </div>
      ))}

      {/* SECTION 2: Standalone / Solo Section */}
      {standaloneEntities.length > 0 && (
        <div className={styles.groupSection}>
          <h2 className={styles.groupHeader}>{standaloneLabel}</h2>
          <div className={styles.cardGrid}>
            {standaloneEntities.map((standalone, idx) => (
              <div
                key={`standalone-${standalone.id}-${idx}`}
                onClick={() => navigate(`/${theme.id}/profile/${standalone.id}`)}
                className={styles.cardWrapper}
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
        </div>
      )}

      {/* SECTION 3: Disbanded & Historical Groups */}
      {inactiveBuckets.map(({ parent, children }) => (
        <div key={parent.id} className={styles.groupSection}>
          <h2 className={styles.groupHeader}>{parent.name} ({inactiveLabel})</h2>
          <div className={styles.cardGrid}>
            {children.map((child, idx) => (
              <div
                key={`${parent.id}-${child.id}-${idx}`}
                onClick={() => navigate(`/${theme.id}/profile/${child.id}`)}
                className={styles.cardWrapper}
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
        </div>
      ))}
    </div>
  );
};