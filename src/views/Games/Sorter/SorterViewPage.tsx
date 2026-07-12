import { useState, useMemo, useEffect } from 'react';
import { SorterView } from './SorterView';
import type { Theme, HydratedEntity, BaseEntity } from '../../../types';
import type { EloExtended } from './eloUtils';
import { INITIAL_ELO } from './eloUtils';
import styles from './Sorter.module.css';

interface SorterViewPageProps {
    theme: Theme;
}

export function SorterViewPage({ theme }: SorterViewPageProps) {
    // STAP 1: Geef elke entiteit nu ook een lege geschiedenis-array mee om te voldoen aan EloExtended
    const entitiesWithEloState = useMemo<EloExtended<HydratedEntity>[]>(() => {
        const allEntities = theme.entities || [];
        return allEntities.map(entity => ({
            ...entity,
            elo: INITIAL_ELO,
            matchesPlayed: 0,
            playedAgainst: [] 
        }));
    }, [theme.entities]);

    // Stap 2: Filter de lijst strikt zodat ALLEEN entiteiten van het type 'l4' geselecteerd worden om te ranken.
    const rankableItems = useMemo<EloExtended<HydratedEntity>[]>(() => {
        return entitiesWithEloState.filter(entity => entity.type === 'l4');
    }, [entitiesWithEloState]);

    // Stap 3: Bouw de filteropties (l1, l2, l3) op basis van de relaties die aan onze l4-items gekoppeld zitten.
    const filterCategories = useMemo(() => {
        const layer1Map = new Map<string, BaseEntity>();
        const layer2Map = new Map<string, BaseEntity>();
        const layer3Map = new Map<string, BaseEntity>();

        rankableItems.forEach(item => {
            item.targetConnections?.forEach(connection => {
                const connectedParent = connection.sourceEntity;
                if (!connectedParent) return;

                if (connectedParent.type === 'l1') layer1Map.set(connectedParent.id, connectedParent);
                if (connectedParent.type === 'l2') layer2Map.set(connectedParent.id, connectedParent);
                if (connectedParent.type === 'l3') layer3Map.set(connectedParent.id, connectedParent);
            });
        });

        return {
            layer1: Array.from(layer1Map.values()),
            layer2: Array.from(layer2Map.values()),
            layer3: Array.from(layer3Map.values()),
        };
    }, [rankableItems]);

    // State waarin we de IDs bijhouden van de l1/l2/l3-groepen die door de gebruiker zijn AANGEVINKT om te uitsluiten.
    const [excludedGroupIds, setExcludedGroupIds] = useState<string[]>([]);

    // Geeft aan of de sorter daadwerkelijk gestart is (schakelt tussen optiescherm alleyspeelscherm).
    const [isSorterActive, setIsSorterActive] = useState<boolean>(false);

    // De uiteindelijke selectie van l4-items die naar het speelscherm wordt gestuurd zodra de gebruiker op start drukt.
    const [finalTournamentSelection, setFinalTournamentSelection] = useState<EloExtended<HydratedEntity>[]>([]);

    // Dynamisch scrollen blokkeren op de app-container en de body zodra deze pagina getoond wordt
    useEffect(() => {
        const appContainerEl = document.querySelector('.app-container');
        
        if (appContainerEl) {
            (appContainerEl as HTMLElement).style.height = '100vh';
            (appContainerEl as HTMLElement).style.overflow = 'hidden';
            document.body.style.overflow = 'hidden';
        }
        
        return () => {
            if (appContainerEl) {
                (appContainerEl as HTMLElement).style.height = '';
                (appContainerEl as HTMLElement).style.overflow = '';
            }
            document.body.style.overflow = '';
        };
    }, []);

    // Schakel een groep in of uit de uitsluitingslijst.
    const handleToggleExclusion = (id: string): void => {
        setExcludedGroupIds(prevIds =>
            prevIds.includes(id) ? prevIds.filter(itemId => itemId !== id) : [...prevIds, id]
        );
    };

    // Stap 4: Live berekening van de l4-items. Een item blijft ALTIJD beschikbaar 
    // zolang het gekoppeld is aan ten minste één groep die NIET is uitgevinkt.
    const activeMatchCandidates = useMemo<EloExtended<HydratedEntity>[]>(() => {
        return rankableItems.filter(item => {
            const connectedParentIds = item.targetConnections?.map(conn => conn.sourceEntityId) || [];

            if (excludedGroupIds.length === 0) return true;

            const heeftActieveRelatie = connectedParentIds.some(parentId => !excludedGroupIds.includes(parentId));

            return heeftActieveRelatie;
        });
    }, [rankableItems, excludedGroupIds]);

    // Start de sorter en vergrendel de huidige selectie.
    const handleStartSorter = (): void => {
        setFinalTournamentSelection(activeMatchCandidates);
        setIsSorterActive(true);
    };

    if (!isSorterActive) {
        return (
            <div className={styles.optionsContainer}>
                <h2 className={styles.title}>{theme.title} Sorter</h2>
                <p className={styles.description}>Exclude related options below to customize your rating pool.</p>

                {/* FILTERS VOOR LAAG 1 */}
                {filterCategories.layer1.length > 0 && (
                    <div className={styles.filterSection}>
                        <h3 className={styles.sectionTitle}>{theme.labels['l1'] || 'Layer 1'}</h3>
                        <div className={styles.grid}>
                            {filterCategories.layer1.map(group => (
                                <label key={group.id} className={styles.checkboxLabel}>
                                    <input
                                        type="checkbox"
                                        className={styles.checkboxInput}
                                        checked={excludedGroupIds.includes(group.id)}
                                        onChange={() => handleToggleExclusion(group.id)}
                                    />
                                    <span className={styles.groupName}>{group.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                {/* FILTERS VOOR LAAG 2 */}
                {filterCategories.layer2.length > 0 && (
                    <div className={styles.filterSection}>
                        <h3 className={styles.sectionTitle}>{theme.labels['l2'] || 'Layer 2'}</h3>
                        <div className={styles.grid}>
                            {filterCategories.layer2.map(group => (
                                <label key={group.id} className={styles.checkboxLabel}>
                                    <input
                                        type="checkbox"
                                        className={styles.checkboxInput}
                                        checked={excludedGroupIds.includes(group.id)}
                                        onChange={() => handleToggleExclusion(group.id)}
                                    />
                                    <span className={styles.groupName}>{group.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                {/* FILTERS VOOR LAAG 3 */}
                {filterCategories.layer3.length > 0 && (
                    <div className={styles.filterSection}>
                        <h3 className={styles.sectionTitle}>{theme.labels['l3'] || 'Layer 3'}</h3>
                        <div className={styles.grid}>
                            {filterCategories.layer3.map(group => (
                                <label key={group.id} className={styles.checkboxLabel}>
                                    <input
                                        type="checkbox"
                                        className={styles.checkboxInput}
                                        checked={excludedGroupIds.includes(group.id)}
                                        onChange={() => handleToggleExclusion(group.id)}
                                    />
                                    <span className={styles.groupName}>{group.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                <button
                    onClick={handleStartSorter}
                    disabled={activeMatchCandidates.length < 2}
                    className={styles.startButton}
                >
                    Start Sorter ({activeMatchCandidates.length} items remaining)
                </button>
            </div>
        );
    }

    return <SorterView theme={theme} initialPool={finalTournamentSelection} />;
}