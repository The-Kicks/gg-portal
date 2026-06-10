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
 * L2View processes relational map groupings that link Layer 2 nodes upward to Layer 1 roots.
 * Analogy: Engine Power Unit Manufacturers or Sub-Agencies (e.g., Ferrari Powertrains, SM Entertainment).
 */
export const L2View: React.FC<Props> = ({ theme }) => {
  const navigate = useNavigate();
  const parentMap = new Map<string, ParentBucket>();

  const endpoints = theme.entities?.filter((e) => e.type === 'l2') || [];

  if (endpoints.length === 0) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text)' }}>
        <h3>Geen data gevonden voor {theme.labels.l2 || 'Laag 2'}. 🛑</h3>
      </div>
    );
  }

  // Isolates independent structural operators marked as standalone nodes
  const standaloneEntities = endpoints.filter((endpoint) => endpoint.isStandalone);

  // RELATIONAL GRAPH MAPPING SYSTEM: Evaluates connection lines to map L2 children into L1 clusters
  endpoints.forEach((l2Entity) => {
    const allConns = [...(l2Entity.connections || []), ...(l2Entity.targetConnections || [])];

    allConns.forEach((conn) => {
      const sourceEntity = conn.sourceEntity;
      const targetEntity = conn.targetEntity;

      let l1Entity: BaseEntity | null = null;
      if (sourceEntity?.type === 'l1') l1Entity = sourceEntity;
      else if (targetEntity?.type === 'l1') l1Entity = targetEntity;

      if (!l1Entity) return;

      // Filter sequence: Blocks corporate background details if hideFromGrid flags are present
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

  // Distributes operational structural blocks separate from defunct corporate groupings sets
  const activeBuckets = allBuckets.filter((b) => !isInactiveStatus(b.parent.status || ''));
  const inactiveBuckets = allBuckets.filter((b) => isInactiveStatus(b.parent.status || ''));

  return (
    <div className={styles.layerContainer}>
      {/* SECTION 1: Conglomerate-backed Sub-Agencies / Subsidiaries */}
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

      {/* SECTION 2: Independent Operators (No major conglomerate backing) */}
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

      {/* SECTION 3: Historical / Defunct Corporate Divisions */}
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