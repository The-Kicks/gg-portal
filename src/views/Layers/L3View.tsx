import { useNavigate } from 'react-router-dom';
import type { Theme, HydratedEntity, BaseEntity } from '../../types';
import { EntityCard } from '../../core/components/UI/PortalCard/EntityCard/EntityCard';
import styles from './LayerView.module.css';

interface Props {
  theme: Theme;
}

/**
 * L3View handles displaying operational working brands or groups.
 * Analogy: Formula 1 Constructors / Racing Teams or Pop Groups (e.g., Scuderia Ferrari, IVE, IZ*ONE).
 */
export const L3View: React.FC<Props> = ({ theme }) => {
  const navigate = useNavigate();
  const allEntities = theme.entities || [];

  // Extract all Layer 3 structural team records nodes
  const groups = allEntities.filter((e) => e.type === 'l3');

  if (groups.length === 0) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text)' }}>
        <h3>Geen data gevonden voor {theme.labels.l3 || 'Laag 3'}. 🛑</h3>
      </div>
    );
  }

  /**
   * Recursive Parent Resolver Traversal Utility.
   * Scans a Layer 3 network entity connection stream backward to pinpoint its closest parent hierarchy node.
   * Prioritizes neighboring L2 manufacturers first before jumping up to global L1 parent clusters.
   */
  const findClosestParent = (entity: HydratedEntity, preferredTypes: string[]): BaseEntity | null => {
    const conns = [...(entity.connections || []), ...(entity.targetConnections || [])];

    // Stage A: Scans for direct immediate structural connections on preferred type priorities keys
    for (const type of preferredTypes) {
      for (const conn of conns) {
        if (conn.sourceEntity?.type === type) return conn.sourceEntity;
        if (conn.targetEntity?.type === type) return conn.targetEntity;
      }
    }

    // Stage B: Multi-tiered fallback trace mechanism. 
    // If an intermediate L2 node is missing direct link metadata but exists inside core records, 
    // it bridges the graph line to resolve the overarching L1 root company.
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

  // Sorts all structural group nodes alphabetically by default name values
  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className={styles.layerContainer}>
      <div className={styles.cardGrid}>
        {sortedGroups.map((group) => {
          // Dynamic execution: Looks up the matching closest parent tree node (L2 or L1 fallback)
          const closestParent = findClosestParent(group, ['l2', 'l1']);

          // Normalizes string parameters to verify if a brand is archived or disbanded
          const isDisbanded = ['disbanded', 'inactive', 'retired', 'historical'].includes(
            (group.status || '').toLowerCase().trim()
          );

          // Conditionally injects greyed out styles if historical status flags apply
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
                organization={closestParent || undefined} // Attaches determined parent profile values
                customLabel={theme.labels.l3}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};