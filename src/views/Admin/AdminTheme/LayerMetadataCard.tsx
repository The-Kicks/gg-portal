/**
 * COMPONENT: LayerMetadataCard.tsx
 * * Doel: Een herbruikbaar formulier-onderdeel voor het configureren van 
 * specifieke metadata (zoals status-triggers en grid-keys) per laag (L1 t/m L4).
 */
import type { MetaDataStandard } from '../../../types';
import type { MetaInputState } from './useAdminTheme';
import styles from '../AdminGlobal.module.css'; 

interface LayerMetadataCardProps {
    layer: string;
    layerAlias: string;
    layerMeta: MetaDataStandard;
    inputs: MetaInputState;
    onLayerStringChange: (layer: string, key: 'badgeKey' | 'subtitleKey', val: string) => void;
    onLayerArrayChange: (layer: string, key: keyof MetaInputState, val: string) => void;
}

export function LayerMetadataCard({
    layer, layerAlias, layerMeta, inputs, onLayerStringChange, onLayerArrayChange
}: LayerMetadataCardProps) {
    return (
        <div className={styles.configSectionBlock}>
            <h5>
                {layer.toUpperCase()} — {layerAlias}
            </h5>

            <div className={styles.verticalStack}>
                {/* Bovenste Grid voor de Badge- en Subtitle Keys */}
                <div className={styles.twoColumnGrid}>
                    <div>
                        <label className={styles.fieldLabel}>ProfileBadgeKey (badgeKey):</label>
                        <input
                            type="text"
                            value={layerMeta.badgeKey || ''}
                            onChange={e => onLayerStringChange(layer, 'badgeKey', e.target.value)}
                            placeholder="Bijv. City of Role"
                            className={styles.inputField}
                        />
                    </div>
                    <div>
                        <label className={styles.fieldLabel}>ProfileSubtitleKey (subtitleKey):</label>
                        <input
                            type="text"
                            value={layerMeta.subtitleKey || ''}
                            onChange={e => onLayerStringChange(layer, 'subtitleKey', e.target.value)}
                            placeholder="Bijv. Stadium of Group"
                            className={styles.inputField}
                        />
                    </div>
                </div>

                {/* Profiel Grid Velden Input */}
                <div>
                    <label className={styles.fieldLabel}>Profiel Grid Velden (gridKeys - met komma's):</label>
                    <input
                        type="text"
                        value={inputs.gridKeys}
                        onChange={e => onLayerArrayChange(layer, 'gridKeys', e.target.value)}
                        placeholder="Bijv. Birthday, Nationality, Active Years"
                        className={styles.inputField}
                    />
                </div>

                {/* Media Asset Sleutels Input */}
                <div>
                    <label className={styles.fieldLabel}>
                        Media Asset Sleutels (mediaKeys - met komma's):
                    </label>
                    <input
                        type="text"
                        value={inputs.mediaKeys || ''} 
                        onChange={e => onLayerArrayChange(layer, 'mediaKeys', e.target.value)}
                        placeholder="Bijv. logo, fanart, customBanner"
                        className={styles.inputField}
                    />
                </div>

                {/* Status Badge Triggers Sectie */}
                <div className={styles.innerSection}>
                    <h6>
                        Status Badge Triggers (Match Waarde)
                    </h6>

                    <div className={styles.verticalStack}>
                        {(['Former', 'Alert', 'Warning', 'Info'] as const).map(type => {
                            const stateKey = `status${type}Val` as keyof MetaInputState;
                            const labelText = type === 'Former' ? 'Former / Oud-lid' : type === 'Alert' ? 'Alert / Gevaar' : type === 'Warning' ? 'Warning / Waarschuwing' : 'Info / Actief';
                            
                            return (
                                <div key={type}>
                                    <label className={styles.fieldLabel}>{labelText} Trigger Waarde:</label>
                                    <input
                                        type="text"
                                        placeholder="Bijv. active / inactive / injured"
                                        value={inputs[stateKey] || ''}
                                        onChange={e => onLayerArrayChange(layer, stateKey, e.target.value)}
                                        className={styles.inputField}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}