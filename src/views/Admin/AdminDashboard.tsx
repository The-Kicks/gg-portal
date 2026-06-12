import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Theme } from '../../types';
import styles from './AdminGlobal.module.css'; 

interface Props { 
  theme: Theme | undefined | null; 
}

const LAYER_ORDER: Record<string, number> = { l1: 1, l2: 2, l3: 3, l4: 4 };
type ThemeEntity = NonNullable<Theme['entities']>[number];

interface ExpectedConnection {
  id?: string;
  entityId?: string;
  sourceEntityId?: string;
  targetEntityId?: string;
  sourceEntity?: { id: string; type: string; name: string };
  targetEntity?: { id: string; type: string; name: string };
}

interface TableRow {
  entity: ThemeEntity;
  displayParent: string;
  rowId: string;
}

export const AdminDashboard: React.FC<Props> = ({ theme }) => {
  const { themeName } = useParams<{ themeName: string }>();
  const navigate = useNavigate();
  const [filterType, setFilterType] = useState<string>('all');

  const resolveParentAssignment = (entity: ThemeEntity, allEntities: ThemeEntity[]): string => {
    const currentLayer = entity.type.toLowerCase();
    
    if (currentLayer === 'l1') return '-';

    const extendedEntity = entity as ThemeEntity & { 
      connections?: ExpectedConnection[];
      targetConnections?: ExpectedConnection[]; 
    };
    
    const allConnections = [
      ...(extendedEntity.connections || []),
      ...(extendedEntity.targetConnections || [])
    ];

    if (allConnections.length === 0) return '-';

    let targetLayers: string[] = [];
    if (currentLayer === 'l4') targetLayers = ['l3', 'l2', 'l1'];
    if (currentLayer === 'l3') targetLayers = ['l2', 'l1'];
    if (currentLayer === 'l2') targetLayers = ['l1'];

    for (const targetLayer of targetLayers) {
      for (const conn of allConnections) {
        if (conn.sourceEntity?.type.toLowerCase() === targetLayer) return conn.sourceEntity.name;
        if (conn.targetEntity?.type.toLowerCase() === targetLayer) return conn.targetEntity.name;

        const possibleIds = [conn.entityId, conn.sourceEntityId, conn.targetEntityId, conn.id].filter(Boolean);
        
        for (const id of possibleIds) {
          const linkedEntity = allEntities.find(e => e.id === id);
          if (linkedEntity && linkedEntity.type.toLowerCase() === targetLayer) {
            return linkedEntity.name;
          }
        }
      }
    }

    return '-';
  };

  const sortedAndFilteredRows = useMemo(() => {
    const allEntities = theme?.entities || [];
    const baseEntities = allEntities.filter(e => 
      filterType === 'all' || e.type.toLowerCase() === filterType.toLowerCase()
    );

    const rows: TableRow[] = baseEntities.map(entity => {
      const parentName = resolveParentAssignment(entity, allEntities);
      return {
        entity,
        displayParent: parentName,
        rowId: `${entity.id}-${parentName}`
      };
    });

    return rows.sort((a, b) => {
      const typeA = a.entity.type.toLowerCase();
      const typeB = b.entity.type.toLowerCase();

      const orderA = LAYER_ORDER[typeA] || 99;
      const orderB = LAYER_ORDER[typeB] || 99;

      if (orderA !== orderB) return orderA - orderB;

      const parentA = a.displayParent;
      const parentB = b.displayParent;
      
      if (parentA === '-' && parentB !== '-') return 1;
      if (parentB === '-' && parentA !== '-') return -1;

      const parentCompare = parentA.localeCompare(parentB);
      if (parentCompare !== 0) return parentCompare;

      return a.entity.name.localeCompare(b.entity.name);
    });
  }, [theme?.entities, filterType]);

  if (!theme) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Admin Workspace</h1>
        <p>Resolving cloud database configurations for {themeName}...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      
      <div className={styles.header}>
        <h1 className={styles.title}>{theme.title} - Admin Dashboard</h1>
        
        <div className={styles.buttonGroup}>
          <button
            onClick={() => navigate(`/${themeName}/admin/theme`)}
            className={`${styles.btn} ${styles.btnOutline}`}
          >
            Theme & Layers Configuration
          </button>

          <button
            onClick={() => navigate(`/${themeName}/admin/create`)}
            className={`${styles.btn} ${styles.btnPrimary}`}
          >
            Add New Entity
          </button>
        </div>
      </div>
      
      <div className={styles.filterGroup}>
        {['all', 'l1', 'l2', 'l3', 'l4'].map(type => (
          <button 
            key={type} 
            onClick={() => setFilterType(type)}
            className={filterType === type ? styles.filterBtnActive : styles.filterBtn}
          >
            {type.toUpperCase()}
          </button>
        ))}
      </div>

      <table className={styles.table}>
        <thead>
          <tr className={styles.tableHeaderRow}>
            <th className={styles.th}>Name</th>
            <th className={styles.th}>Tier Type</th>
            <th className={styles.th}>Parent Context Assignment</th>
            <th className={styles.th}>Status</th>
            <th className={styles.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedAndFilteredRows.length === 0 ? (
            <tr>
              <td colSpan={5} className={`${styles.td} styles.textCenter ${styles.textMuted}`}>
                No entities found matching the selected tier filter.
              </td>
            </tr>
          ) : (
            sortedAndFilteredRows.map((row, index) => {
              const { entity, displayParent, rowId } = row;
              const currentType = entity.type.toLowerCase();
              
              const currentSectionKey = `${currentType}-${displayParent}`;
              const nextRow = sortedAndFilteredRows[index + 1];
              const nextSectionKey = nextRow 
                ? `${nextRow.entity.type.toLowerCase()}-${nextRow.displayParent}`
                : null;

              const isLastOfSection = nextRow && currentSectionKey !== nextSectionKey;

              return (
                <tr 
                  key={rowId} 
                  className={isLastOfSection ? styles.rowSectionEnd : styles.rowNormal}
                >
                  <td className={`${styles.td} ${styles.textBold}`}>{entity.name}</td>
                  <td className={styles.td}>
                    <span className={styles.textMuted}>{entity.type.toUpperCase()}</span>
                  </td>
                  <td className={`${styles.td} ${displayParent !== '-' ? styles.textPrimary : styles.textDimmed}`}>
                    {displayParent}
                  </td>
                  <td className={styles.td}>{entity.status || 'active'}</td>
                  <td className={styles.td}>
                    <button 
                      onClick={() => navigate(`/${themeName}/admin/edit/${entity.id}`)}
                      className={styles.btnEdit}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};