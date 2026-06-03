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
 * L4View renders the individual performers operating at the active base of the framework.
 * Analogy: Drivers or Idols (e.g., Lewis Hamilton, Max Verstappen, Wonyoung, Sakura).
 */
export const L4View: React.FC<Props> = ({ theme }) => {
  const navigate = useNavigate();
  const parentMap = new Map<string, ParentBucket>();

  // Extract all individual Level 4 operational node data models
  const endpoints = theme.entities?.filter((e) => e.type === 'l4') || [];

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

  // Filters down clean standalone performers profiles (Official Solo Acts)
  const standaloneEntities = endpoints.filter((endpoint) => endpoint.isStandalone);

  // MAPPING ANALYSIS SYSTEM: Routes personnel rosters contract connections into explicit L3 Team folders
  endpoints.forEach((l4Entity) => {
    const allConns = [...(l4Entity.connections || []), ...(l4Entity.targetConnections || [])];

    allConns.forEach((conn) => {
      const sourceEntity = conn.sourceEntity;
      const targetEntity = conn.targetEntity;

      let l3Entity: BaseEntity | null = null;
      if (sourceEntity?.type === 'l3') l3Entity = sourceEntity;
      else if (targetEntity?.type === 'l3') l3Entity = targetEntity;

      if (!l3Entity) return;

      // Normalization string evaluation parameters pipelines
      const connectionStatus = (conn.metadata?.status || '').toLowerCase().trim();
      const parentStatus = (l3Entity.status || '').toLowerCase().trim();
      const l4Status = (l4Entity.status || '').toLowerCase().trim();

      // Relational check 1: Verifies if a person's explicit team contract link is broken/past history
      const isFormerConnection = 
        connectionStatus.includes('former') || 
        connectionStatus === 'ex' || 
        connectionStatus === 'retired' || 
        conn.metadata?.isFormer === true;

      // Relational check 2: Verifies if the individual person is globally retired/inactive themselves
      const isL4EntityInactive = ['retired', 'inactive'].includes(l4Status);

      // Relational check 3: Verifies if the parent constructor group itself is officially active
      const isParentInactive = ['disbanded', 'inactive', 'retired', 'historical'].includes(parentStatus);
      const isParentActive = !isParentInactive;

      // AUTOMATIC FILTERING HIDE ENGINE: 
      // Hides old historical connections if the target team is still active in the real world.
      const autoHide = (isFormerConnection || isL4EntityInactive) && isParentActive;

      // CRITICAL DATA ENGINE OVERRIDE: 
      // Defunct teams (e.g. IZ*ONE) bypass autoHide rules to lock and display their entire historical roster intact.
      const isHidden = !isParentInactive && (conn.metadata?.hideFromGrid === true || autoHide);

      if (!isHidden) {
        if (!parentMap.has(l3Entity.id)) {
          parentMap.set(l3Entity.id, { parent: l3Entity, children: [] });
        }
        const bucket = parentMap.get(l3Entity.id)!;
        if (!bucket.children.some((c) => c.id === l4Entity.id)) {
          bucket.children.push(l4Entity);
        }
      }
    });
  });

  const allBuckets = Array.from(parentMap.values());
  const isInactiveStatus = (status: string) =>
    ['disbanded', 'inactive', 'retired', 'historical'].includes(status.toLowerCase().trim());

  /**
   * LINE-UP ROSTER SORTER FUNCTION (BEST PRACTICE)
   * Alphabetically orders children elements, but explicitly pushes reserve/test personnel positions 
   * to the back of the team queue block rows.
   */
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

  // Compiles active racing squads currently competing on the live circuits grid
  const activeBuckets = allBuckets
    .filter((b) => !isInactiveStatus(b.parent.status || ''))
    .sort((a, b) => a.parent.name.localeCompare(b.parent.name))
    .map(bucket => ({ ...bucket, children: sortGroupChildren(bucket.children) }));

  // Compiles defunct/historical constructor rosters archives lines
  const inactiveBuckets = allBuckets
    .filter((b) => isInactiveStatus(b.parent.status || ''))
    .sort((a, b) => a.parent.name.localeCompare(b.parent.name))
    .map(bucket => ({ ...bucket, children: sortGroupChildren(bucket.children) }));

  standaloneEntities.sort((a, b) => a.name.localeCompare(b.name));

  const standaloneLabel = theme.labels['l4_standalone'] ?? 'Solo Career / Standalone';
  const inactiveLabel = theme.labels['disbanded_tag'] ?? 'Inactive / Historical';

  return (
    <div className={styles.layerContainer}>
      
      {/* SECTION 1: Active Constructors & Their Drivers */}
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

      {/* SECTION 2: Independent / Standalone Drivers (Solo Artists) */}
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

      {/* SECTION 3: Defunct & Historical Constructors Archives */}
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