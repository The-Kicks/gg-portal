/**
 * COMPONENT: ThemeOverviewTable.tsx
 * * Doel: Weergave van alle beschikbare thema's in een tabelstructuur.
 * Functies: Biedt actieknoppen voor bewerken en verwijderen per thema.
 */
import type { Theme } from '../../../types';

interface ThemeOverviewTableProps {
    loadedThemes: Theme[];
    onEdit: (theme: Theme) => void;
    onDelete: (id: string) => void;
}

export function ThemeOverviewTable({ loadedThemes, onEdit, onDelete }: ThemeOverviewTableProps) {
    return (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#1e1e1e' }}>
            <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
                    <th style={{ padding: '12px' }}>ID (Slug Sequence)</th>
                    <th style={{ padding: '12px' }}>Title Identifier</th>
                    <th style={{ padding: '12px' }}>Primary Anchor Layer (Org)</th>
                    <th style={{ padding: '12px' }}>Operations Suite</th>
                </tr>
            </thead>
            <tbody>
                {loadedThemes.map((t) => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #333' }}>
                        <td style={{ padding: '12px' }}><strong>{t.id}</strong></td>
                        <td style={{ padding: '12px' }}>{t.title}</td>
                        <td style={{ padding: '12px' }}>{(t.orgLayer || 'l3').toUpperCase()}</td>
                        <td style={{ padding: '12px' }}>
                            <button
                                onClick={() => onEdit(t)}
                                style={{ marginRight: '8px', padding: '6px 12px', background: '#2d2d2d', color: '#deff9a', border: '1px solid #deff9a', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                Modify Style & Layers Configuration
                            </button>
                            <button
                                onClick={() => onDelete(t.id)}
                                style={{ padding: '6px 12px', background: 'transparent', color: '#ff6b6b', border: '1px solid #ff6b6b', cursor: 'pointer' }}
                                disabled={loadedThemes.length === 1}
                            >
                                Purge Record
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}