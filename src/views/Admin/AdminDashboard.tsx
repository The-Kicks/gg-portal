import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Theme } from '../../types';

interface Props { 
  theme: Theme | undefined | null; 
}

const LAYER_ORDER: Record<string, number> = { l1: 1, l2: 2, l3: 3, l4: 4 };
type ThemeEntity = NonNullable<Theme['entities']>[number];

// Flexibele interface voor de connecties, mochten de data-types variëren
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

  /**
   * Krachtige relational lookup helper.
   * Traverseert de entiteiten-lijst om de hiërarchische parent te achterhalen,
   * ongeacht of de connectie is opgeslagen via ID's of geneste objecten.
   */
  const resolveParentAssignment = (entity: ThemeEntity, allEntities: ThemeEntity[]): string => {
    const currentLayer = entity.type.toLowerCase();
    
    // Root level (L1) heeft per definitie geen parent framework boven zich
    if (currentLayer === 'l1') return '-';

    const extendedEntity = entity as ThemeEntity & { 
      connections?: ExpectedConnection[];
      targetConnections?: ExpectedConnection[]; 
    };
    
    // Combineer alle mogelijke connectie-arrays voor maximale tolerantie
    const allConnections = [
      ...(extendedEntity.connections || []),
      ...(extendedEntity.targetConnections || [])
    ];

    if (allConnections.length === 0) return '-';

    // Bepaal de hiërarchische zoekvolgorde op basis van nabijheid
    let targetLayers: string[] = [];
    if (currentLayer === 'l4') targetLayers = ['l3', 'l2', 'l1'];
    if (currentLayer === 'l3') targetLayers = ['l2', 'l1'];
    if (currentLayer === 'l2') targetLayers = ['l1'];

    for (const targetLayer of targetLayers) {
      for (const conn of allConnections) {
        // 1. Check op directe geneste objecten
        if (conn.sourceEntity?.type.toLowerCase() === targetLayer) return conn.sourceEntity.name;
        if (conn.targetEntity?.type.toLowerCase() === targetLayer) return conn.targetEntity.name;

        // 2. Check op ID-gebaseerde connecties (meest waarschijnlijk bij lege resultaten)
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
      <div style={{ padding: '40px', background: '#121212', color: '#fff', minHeight: '100vh' }}>
        <h1>Admin Workspace</h1>
        <p>Resolving cloud database configurations for {themeName}...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '40px', background: '#121212', color: '#fff', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ margin: 0 }}>{theme.title} - Admin Dashboard</h1>
        
        <div style={{ display: 'flex', gap: '15px' }}>
          <button
            onClick={() => navigate(`/${themeName}/admin/theme`)}
            style={{
              padding: '12px 24px', background: '#2d2d2d', color: '#deff9a',
              border: '1px solid #deff9a', borderRadius: '6px', fontWeight: 'bold',
              cursor: 'pointer', fontSize: '15px'
            }}
          >
            Theme & Layers Configuration
          </button>

          <button
            onClick={() => navigate(`/${themeName}/admin/create`)}
            style={{
              padding: '12px 24px', background: '#deff9a', color: '#000',
              border: 'none', borderRadius: '6px', fontWeight: 'bold',
              cursor: 'pointer', fontSize: '15px', boxShadow: '0 4px 6px rgba(0,0,0,0.2)'
            }}
          >
            Add New Entity
          </button>
        </div>
      </div>
      
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        {['all', 'l1', 'l2', 'l3', 'l4'].map(type => (
          <button 
            key={type} 
            onClick={() => setFilterType(type)}
            style={{ 
              padding: '8px 16px', 
              background: filterType === type ? '#deff9a' : '#2d2d2d', 
              color: filterType === type ? '#000' : '#fff', 
              border: 'none', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px'
            }}
          >
            {type.toUpperCase()}
          </button>
        ))}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#1e1e1e' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #333', textAlign: 'left' }}>
            <th style={{ padding: '12px' }}>Name</th>
            <th style={{ padding: '12px' }}>Tier Type</th>
            <th style={{ padding: '12px' }}>Parent Context Assignment</th>
            <th style={{ padding: '12px' }}>Status</th>
            <th style={{ padding: '12px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedAndFilteredRows.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ padding: '12px', textAlign: 'center', color: '#aaa' }}>
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
                  style={{ 
                    borderBottom: isLastOfSection 
                      ? '3px solid #deff9a' 
                      : '1px solid #333' 
                  }}
                >
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>{entity.name}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ color: '#aaa' }}>{entity.type.toUpperCase()}</span>
                  </td>
                  <td style={{ padding: '12px', color: displayParent !== '-' ? '#deff9a' : '#666' }}>
                    {displayParent}
                  </td>
                  <td style={{ padding: '12px' }}>{entity.status || 'active'}</td>
                  <td style={{ padding: '12px' }}>
                    <button 
                      onClick={() => navigate(`/${themeName}/admin/edit/${entity.id}`)}
                      style={{ 
                        background: '#2d2d2d', color: '#deff9a', border: '1px solid #deff9a', 
                        padding: '6px 12px', cursor: 'pointer', fontWeight: 'bold' 
                      }}
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