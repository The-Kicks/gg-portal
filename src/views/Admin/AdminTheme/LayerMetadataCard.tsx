/**
 * COMPONENT: LayerMetadataCard.tsx
 * * Doel: Een herbruikbaar formulier-onderdeel voor het configureren van 
 * specifieke metadata (zoals status-triggers en grid-keys) per laag (L1 t/m L4).
 */
import type { MetaDataStandard } from '../../../types';
import type { MetaInputState } from './useAdminTheme';

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
        <div style={{ background: '#161616', padding: '18px', borderRadius: '6px', border: '1px solid #333' }}>
            <h5 style={{ margin: '0 0 15px 0', color: '#deff9a', fontSize: '14px', textTransform: 'uppercase', borderBottom: '1px dashed #444', paddingBottom: '6px' }}>
                {layer.toUpperCase()} — {layerAlias}
            </h5>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>ProfileBadgeKey (badgeKey):</label>
                    <input
                        type="text"
                        value={layerMeta.badgeKey || ''}
                        onChange={e => onLayerStringChange(layer, 'badgeKey', e.target.value)}
                        placeholder="Bijv. City of Role"
                        style={{ width: '100%', padding: '8px', background: '#2d2d2d', border: '1px solid #555', color: '#fff', borderRadius: '4px', fontSize: '13px' }}
                    />
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>ProfileSubtitleKey (subtitleKey):</label>
                    <input
                        type="text"
                        value={layerMeta.subtitleKey || ''}
                        onChange={e => onLayerStringChange(layer, 'subtitleKey', e.target.value)}
                        placeholder="Bijv. Stadium of Group"
                        style={{ width: '100%', padding: '8px', background: '#2d2d2d', border: '1px solid #555', color: '#fff', borderRadius: '4px', fontSize: '13px' }}
                    />
                </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>Profiel Grid Velden (gridKeys - met komma's):</label>
                <input
                    type="text"
                    value={inputs.gridKeys}
                    onChange={e => onLayerArrayChange(layer, 'gridKeys', e.target.value)}
                    placeholder="Bijv. Birthday, Nationality, Active Years"
                    style={{ width: '100%', padding: '8px', background: '#2d2d2d', border: '1px solid #555', color: '#fff', borderRadius: '4px', fontSize: '13px' }}
                />
            </div>

            <div style={{ borderTop: '1px solid #333', paddingTop: '10px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#deff9a', fontWeight: 'bold', marginBottom: '8px' }}>
                    Status Badge Triggers (Match Waarde)
                </label>

                {(['Former', 'Alert', 'Warning', 'Info'] as const).map(type => {
                    const stateKey = `status${type}Val` as keyof MetaInputState;
                    const labelText = type === 'Former' ? 'Former / Oud-lid' : type === 'Alert' ? 'Alert / Gevaar' : type === 'Warning' ? 'Warning / Waarschuwing' : 'Info / Actief';
                    return (
                        <div key={type} style={{ marginBottom: '8px' }}>
                            <label style={{ display: 'block', fontSize: '11px', color: '#aaa', marginBottom: '2px' }}>{labelText} Trigger Waarde:</label>
                            <input
                                type="text"
                                placeholder="Bijv. active / inactive / injured"
                                value={inputs[stateKey] || ''}
                                onChange={e => onLayerArrayChange(layer, stateKey, e.target.value)}
                                style={{ width: '100%', padding: '8px', background: '#222', border: '1px solid #444', color: '#fff', fontSize: '12px', borderRadius: '4px' }}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}