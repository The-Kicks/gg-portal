/**
 * COMPONENT: ThemeOverviewTable.tsx
 * * Doel: Weergave van alle beschikbare thema's in een tabelstructuur.
 * Functies: Biedt actieknoppen voor bewerken en verwijderen per thema.
 */
import type { Theme } from '../../../types';
import styles from '../AdminGlobal.module.css'; 

interface ThemeOverviewTableProps {
    loadedThemes: Theme[];
    onEdit: (theme: Theme) => void;
    onDelete: (id: string) => void;
}

export function ThemeOverviewTable({ loadedThemes, onEdit, onDelete }: ThemeOverviewTableProps) {
    return (
        <table className={styles.table}>
            <thead>
                <tr className={styles.tableHeaderRow}>
                    <th className={styles.th}>ID (Slug Sequence)</th>
                    <th className={styles.th}>Title Identifier</th>
                    <th className={styles.th}>Primary Anchor Layer (Org)</th>
                    <th className={styles.th}>Operations Suite</th>
                </tr>
            </thead>
            <tbody>
                {loadedThemes.map((t) => (
                    <tr key={t.id} className={styles.rowNormal}>
                        <td className={styles.td}>
                            <strong className={styles.textBold}>{t.id}</strong>
                        </td>
                        <td className={styles.td}>{t.title}</td>
                        <td className={styles.td}>{(t.orgLayer || 'l3').toUpperCase()}</td>
                        <td className={styles.td}>
                            {/* Flexbox wrapper uit jouw CSS om knoppen netjes te positioneren */}
                            <div className={styles.buttonGroup}>
                                <button
                                    onClick={() => onEdit(t)}
                                    className={styles.btnEdit}
                                >
                                    Modify Style & Layers Configuration
                                </button>
                                <button
                                    onClick={() => onDelete(t.id)}
                                    className={styles.btnUnlink}
                                    disabled={loadedThemes.length === 1}
                                >
                                    Purge Record
                                </button>
                            </div>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}