import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createTheme, updateTheme, deleteTheme } from '../../core/api';
import { GLOBAL_AVAILABLE_GAMES } from '../../core/gamesConfig'; 
import type { Theme, MetaDataStandard } from '../../types';

interface AdminThemeManagerProps {
    loadedThemes: Theme[];
    onRefresh: () => Promise<void>;
}

const AVAILABLE_LAYERS = ['l1', 'l2', 'l3', 'l4'];

const CUSTOM_PORTAL_LABELS = [
    { key: 'l4_standalone', label: 'L4 Standalone / Iconen Sectie', placeholder: 'Bijv. Clubloos / Iconen & Legendes' },
    { key: 'disbanded_tag', label: 'Inactief / Opgeheven Label Achtervoegsel', placeholder: 'Bijv. Opgeheven / Historisch' }
];

const FIXED_STATUS_KEY = "clubStatus.member";

interface MetaInputState {
    gridKeys: string;
    statusFormerVal: string;
    statusAlertVal: string;
    statusWarningVal: string;
    statusInfoVal: string;
}

export function AdminThemeManager({ loadedThemes, onRefresh }: AdminThemeManagerProps) {
    const navigate = useNavigate();
    const { themeName } = useParams<{ themeName: string }>();

    const [editingTheme, setEditingTheme] = useState<Partial<Theme> | null>(null);
    const [isNew, setIsNew] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const [metaInputs, setMetaInputs] = useState<Record<string, MetaInputState>>({});

    const emptyTheme: Partial<Theme> = {
        id: '', title: '', description: '', orgLayer: 'l3',
        miniViewLayers: ['l1'], primaryColor: '#e10600', secondaryColor: '#1f1f1f',
        backgroundColor: '#ffffff', navbarColor: '#e10600', textColor: '#15151e',
        darkPrimaryColor: '#e10600', darkSecondaryColor: '#ffffff', darkBackgroundColor: '#0f0f14',
        darkTextColor: '#f3f3f3', darkNavbarColor: '#000000',
        games: ['sorter'], navbarItems: ['l4', 'l3', 'l1'],
        labels: { 
            l1: 'Industry', 
            l2: 'Label', 
            l3: 'Group', 
            l4: 'Driver',
            l4_standalone: 'Solo Career / Standalone',
            disbanded_tag: 'Inactive / Historical'
        },
        layerMetadata: {}
    };

    const handleStartCreate = () => {
        const initialMetaInputs: Record<string, MetaInputState> = {};
        AVAILABLE_LAYERS.forEach(layer => {
            initialMetaInputs[layer] = {
                gridKeys: layer === 'l4' ? 'Birthday, Nationality' : '',
                statusFormerVal: '',
                statusAlertVal: '',
                statusWarningVal: '',
                statusInfoVal: ''
            };
        });
        setMetaInputs(initialMetaInputs);

        setEditingTheme({
            ...emptyTheme,
            layerMetadata: {
                l4: {
                    badgeKey: 'Role',
                    subtitleKey: 'Group',
                    gridKeys: ['Birthday', 'Nationality']
                }
            }
        });
        setIsNew(true);
        setError(null);
    };

    const handleStartEdit = (theme: Theme) => {
        setEditingTheme({ ...theme });
        setIsNew(false);
        setError(null);

        const initialMetaInputs: Record<string, MetaInputState> = {};
        const layerMetadataRecord = (theme.layerMetadata || {}) as Record<string, MetaDataStandard>;

        AVAILABLE_LAYERS.forEach(layer => {
            const layerData = layerMetadataRecord[layer];
            initialMetaInputs[layer] = {
                gridKeys: layerData?.gridKeys ? layerData.gridKeys.join(', ') : '',
                statusFormerVal: layerData?.statusTriggers?.former?.value || '',
                statusAlertVal: layerData?.statusTriggers?.alert?.value || '',
                statusWarningVal: layerData?.statusTriggers?.warning?.value || '',
                statusInfoVal: layerData?.statusTriggers?.info?.value || ''
            };
        });
        
        setMetaInputs(initialMetaInputs);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm(`Are you certain you want to purge theme "${id}"?`)) return;
        try {
            await deleteTheme(id);
            window.dispatchEvent(new Event('refresh-database'));
            await onRefresh();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'An unidentified infrastructure failure occurred.';
            alert(msg);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTheme?.id || !editingTheme.title) {
            setError("Unique Identifier and Title attributes are required.");
            return;
        }

        const finalLayerMetadata: Record<string, MetaDataStandard> = {};
        const currentMetaObj = (editingTheme.layerMetadata || {}) as Record<string, MetaDataStandard>;

        AVAILABLE_LAYERS.forEach(layer => {
            const layerData = currentMetaObj[layer];
            const inputs = metaInputs[layer];

            if (!inputs) return;

            const gridKeysArr = inputs.gridKeys.split(',').map(s => s.trim()).filter(Boolean);
            const statusTriggers: NonNullable<MetaDataStandard['statusTriggers']> = {};
            
            if (inputs.statusFormerVal) {
                statusTriggers.former = { key: FIXED_STATUS_KEY, value: inputs.statusFormerVal };
            }
            if (inputs.statusAlertVal) {
                statusTriggers.alert = { key: FIXED_STATUS_KEY, value: inputs.statusAlertVal };
            }
            if (inputs.statusWarningVal) {
                statusTriggers.warning = { key: FIXED_STATUS_KEY, value: inputs.statusWarningVal };
            }
            if (inputs.statusInfoVal) {
                statusTriggers.info = { key: FIXED_STATUS_KEY, value: inputs.statusInfoVal };
            }

            const badgeKey = layerData?.badgeKey || '';
            const subtitleKey = layerData?.subtitleKey || '';

            if (badgeKey || subtitleKey || gridKeysArr.length || Object.keys(statusTriggers).length > 0) {
                finalLayerMetadata[layer] = {
                    badgeKey,
                    subtitleKey,
                    gridKeys: gridKeysArr,
                    ...(Object.keys(statusTriggers).length > 0 ? { statusTriggers } : {})
                };
            }
        });

        const payload = {
            ...editingTheme,
            layerMetadata: finalLayerMetadata
        };

        try {
            if (isNew) {
                await createTheme(payload);
            } else {
                await updateTheme(editingTheme.id, payload);
            }
            setEditingTheme(null);
            window.dispatchEvent(new Event('refresh-database'));
            await onRefresh();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'An error occurred during save execution.';
            setError(msg);
        }
    };

    const updateLabel = (key: string, val: string) => {
        if (!editingTheme) return;
        const currentLabels = { ...(editingTheme.labels || {}) };
        currentLabels[key] = val;
        setEditingTheme({ ...editingTheme, labels: currentLabels });
    };

    const updateLayerString = (layer: string, key: 'badgeKey' | 'subtitleKey', val: string) => {
        if (!editingTheme) return;
        const currentMeta = { ...((editingTheme.layerMetadata || {}) as Record<string, MetaDataStandard>) };
        const baseLayer = currentMeta[layer] || { badgeKey: '', subtitleKey: '', gridKeys: [] };
        
        currentMeta[layer] = {
            ...baseLayer,
            [key]: val
        };
        
        setEditingTheme({ ...editingTheme, layerMetadata: currentMeta });
    };

    const updateLayerArrayInput = (layer: string, key: keyof MetaInputState, val: string) => {
        setMetaInputs(prev => ({
            ...prev,
            [layer]: {
                ...prev[layer],
                [key]: val
            }
        }));
    };

    const handleArrayToggle = (field: 'miniViewLayers' | 'games' | 'navbarItems', value: string) => {
        if (!editingTheme) return;

        const currentArray = (editingTheme[field] as string[]) || [];
        const newArray = currentArray.includes(value)
            ? currentArray.filter(item => item !== value)
            : [...currentArray, value];

        if (field === 'games') {
            setEditingTheme({ ...editingTheme, games: newArray as Theme['games'] });
        } else if (field === 'miniViewLayers') {
            setEditingTheme({ ...editingTheme, miniViewLayers: newArray });
        } else if (field === 'navbarItems') {
            setEditingTheme({ ...editingTheme, navbarItems: newArray });
        }
    };

    const layerMetadataRecord = (editingTheme?.layerMetadata || {}) as Record<string, MetaDataStandard>;

    return (
        <div style={{ padding: '40px', background: '#121212', color: '#fff', minHeight: '100vh', fontFamily: 'sans-serif' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h2 style={{ margin: 0 }}>Portals & Theme Brand Identities</h2>
                <button
                    onClick={() => navigate(`/${themeName}/admin`)}
                    style={{ padding: '10px 20px', background: '#2d2d2d', color: '#fff', border: '1px solid #555', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                    Return to Control Panel
                </button>
            </div>

            {!editingTheme ? (
                <div>
                    <button onClick={handleStartCreate} style={{ padding: '12px 24px', background: '#deff9a', color: '#000', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginBottom: '20px' }}>
                        Generate New Theme Record
                    </button>

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
                                            onClick={() => handleStartEdit(t)}
                                            style={{ marginRight: '8px', padding: '6px 12px', background: '#2d2d2d', color: '#deff9a', border: '1px solid #deff9a', cursor: 'pointer', fontWeight: 'bold' }}
                                        >
                                            Modify Style & Layers Configuration
                                        </button>
                                        <button
                                            onClick={() => handleDelete(t.id)}
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
                </div>
            ) : (
                <form onSubmit={handleSave} style={{ background: '#1e1e1e', padding: '30px', borderRadius: '8px', border: '1px solid #333' }}>
                    <h3>{isNew ? 'Configure New Theme Instance' : `Modify System Theme Profile: ${editingTheme.id}`}</h3>
                    {error && <p style={{ color: '#ff6b6b', fontWeight: 'bold' }}>Exception Alert: {error}</p>}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', color: '#aaa' }}>Theme Unique ID (Routing URL Slug String):</label>
                            <input
                                type="text"
                                disabled={!isNew}
                                value={editingTheme.id || ''}
                                onChange={e => {
                                    const sanitizedValue = e.target.value
                                        .toLowerCase()
                                        .replace(/\s+/g, '-')
                                        .replace(/[^a-z0-9-]/g, '');
                                    setEditingTheme({ ...editingTheme, id: sanitizedValue });
                                }}
                                placeholder="e.g., kpop-gg"
                                style={{ width: '100%', padding: '10px', background: '#2d2d2d', border: '1px solid #555', color: '#fff', borderRadius: '4px' }}
                                required
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', color: '#aaa' }}>Theme Title Reference:</label>
                            <input type="text" value={editingTheme.title || ''} onChange={e => setEditingTheme({ ...editingTheme, title: e.target.value })} style={{ width: '100%', padding: '10px', background: '#2d2d2d', border: '1px solid #555', color: '#fff', borderRadius: '4px' }} required />
                        </div>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', color: '#aaa' }}>Description Meta Content:</label>
                        <textarea value={editingTheme.description || ''} onChange={e => setEditingTheme({ ...editingTheme, description: e.target.value })} style={{ width: '100%', padding: '10px', background: '#2d2d2d', border: '1px solid #555', color: '#fff', borderRadius: '4px', height: '60px' }} />
                    </div>

                    <h4 style={{ marginTop: '30px', color: '#deff9a', borderBottom: '1px solid #333', paddingBottom: '6px' }}>Structure & Navigation Topologies</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', background: '#161616', padding: '20px', borderRadius: '6px', marginBottom: '20px' }}>
                        <div>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', color: '#aaa', fontWeight: 'bold' }}>Core Anchor Stratum Selection (Org Layer):</label>
                                <select
                                    value={editingTheme.orgLayer || 'l3'}
                                    onChange={e => setEditingTheme({ ...editingTheme, orgLayer: e.target.value })}
                                    style={{ width: '100%', padding: '10px', background: '#2d2d2d', border: '1px solid #555', color: '#fff', borderRadius: '4px' }}
                                >
                                    <option value="l1">Layer 1 (Company / Industry Framework)</option>
                                    <option value="l2">Layer 2 (Label Identity Layer)</option>
                                    <option value="l3">Layer 3 (Group / Team Formation)</option>
                                    <option value="l4">Layer 4 (Individual Asset / Driver Level)</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', color: '#aaa', fontWeight: 'bold' }}>Miniature View Composition Horizons:</label>
                                {AVAILABLE_LAYERS.map(layer => (
                                    <label key={layer} style={{ display: 'inline-flex', alignItems: 'center', marginRight: '15px', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={((editingTheme.miniViewLayers || []) as string[]).includes(layer)}
                                            onChange={() => handleArrayToggle('miniViewLayers', layer)}
                                            style={{ marginRight: '6px' }}
                                        />
                                        {layer.toUpperCase()}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', color: '#aaa', fontWeight: 'bold' }}>Active Application Modules for Theme Context:</label>
                                {GLOBAL_AVAILABLE_GAMES.map(game => (
                                    <label key={game.id} style={{ display: 'inline-flex', alignItems: 'center', marginRight: '15px', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={((editingTheme.games || []) as string[]).includes(game.id)}
                                            onChange={() => handleArrayToggle('games', game.id)}
                                            style={{ marginRight: '6px' }}
                                        />
                                        {game.name}
                                    </label>
                                ))}
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', color: '#aaa', fontWeight: 'bold' }}>Navigation Interface Display Elements:</label>
                                {AVAILABLE_LAYERS.map(layer => (
                                    <label key={layer} style={{ display: 'inline-flex', alignItems: 'center', marginRight: '15px', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={((editingTheme.navbarItems || []) as string[]).includes(layer)}
                                            onChange={() => handleArrayToggle('navbarItems', layer)}
                                            style={{ marginRight: '6px' }}
                                        />
                                        {layer.toUpperCase()}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    <h4 style={{ marginTop: '30px', color: '#deff9a', borderBottom: '1px solid #333', paddingBottom: '6px' }}>Layer Schema Nomenclature Definitions</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                        {AVAILABLE_LAYERS.map((layer) => (
                            <div key={layer}>
                                <label style={{ display: 'block', marginBottom: '6px', color: '#aaa' }}>{layer.toUpperCase()} Display Reference Alias:</label>
                                <input
                                    type="text"
                                    placeholder="e.g., Division Hierarchy"
                                    value={editingTheme.labels?.[layer] || ''}
                                    onChange={e => updateLabel(layer, e.target.value)}
                                    style={{ width: '100%', padding: '10px', background: '#2d2d2d', border: '1px solid #555', color: '#fff', borderRadius: '4px' }}
                                />
                            </div>
                        ))}
                    </div>

                    <h4 style={{ marginTop: '30px', color: '#deff9a', borderBottom: '1px solid #333', paddingBottom: '6px' }}>Custom Portal Display Labels</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                        {CUSTOM_PORTAL_LABELS.map((custom) => (
                            <div key={custom.key}>
                                <label style={{ display: 'block', marginBottom: '6px', color: '#aaa' }}>{custom.label}:</label>
                                <input
                                    type="text"
                                    placeholder={custom.placeholder}
                                    value={editingTheme.labels?.[custom.key] || ''}
                                    onChange={e => updateLabel(custom.key, e.target.value)}
                                    style={{ width: '100%', padding: '10px', background: '#2d2d2d', border: '1px solid #555', color: '#fff', borderRadius: '4px' }}
                                />
                            </div>
                        ))}
                    </div>

                    <h4 style={{ marginTop: '30px', color: '#deff9a', borderBottom: '1px solid #333', paddingBottom: '6px' }}>
                        Layer Metadata Standard Configuration
                    </h4>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                        {AVAILABLE_LAYERS.map((layer) => {
                            const layerMeta = layerMetadataRecord[layer] || { badgeKey: '', subtitleKey: '', gridKeys: [] };
                            const inputs = metaInputs[layer] || { gridKeys: '', statusFormerVal: '', statusAlertVal: '', statusWarningVal: '', statusInfoVal: '' };
                            const layerAlias = editingTheme.labels?.[layer] || `Layer ${layer.toUpperCase()}`;

                            return (
                                <div key={layer} style={{ background: '#161616', padding: '18px', borderRadius: '6px', border: '1px solid #333' }}>
                                    <h5 style={{ margin: '0 0 15px 0', color: '#deff9a', fontSize: '14px', textTransform: 'uppercase', borderBottom: '1px dashed #444', paddingBottom: '6px' }}>
                                        {layer.toUpperCase()} — {layerAlias}
                                    </h5>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>ProfileBadgeKey (badgeKey):</label>
                                            <input 
                                                type="text"
                                                value={layerMeta.badgeKey || ''}
                                                onChange={e => updateLayerString(layer, 'badgeKey', e.target.value)}
                                                placeholder="Bijv. City of Role"
                                                style={{ width: '100%', padding: '8px', background: '#2d2d2d', border: '1px solid #555', color: '#fff', borderRadius: '4px', fontSize: '13px' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', color: '#aaa', marginBottom: '4px' }}>ProfileSubtitleKey (subtitleKey):</label>
                                            <input 
                                                type="text"
                                                value={layerMeta.subtitleKey || ''}
                                                onChange={e => updateLayerString(layer, 'subtitleKey', e.target.value)}
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
                                            onChange={e => updateLayerArrayInput(layer, 'gridKeys', e.target.value)}
                                            placeholder="Bijv. Birthday, Nationality, Active Years"
                                            style={{ width: '100%', padding: '8px', background: '#2d2d2d', border: '1px solid #555', color: '#fff', borderRadius: '4px', fontSize: '13px' }}
                                        />
                                    </div>

                                    <div style={{ borderTop: '1px solid #333', paddingTop: '10px' }}>
                                        <label style={{ display: 'block', fontSize: '12px', color: '#deff9a', fontWeight: 'bold', marginBottom: '8px' }}>
                                            Status Badge Triggers (Match Waarde)
                                        </label>
                                        
                                        <div style={{ marginBottom: '8px' }}>
                                            <label style={{ display: 'block', fontSize: '11px', color: '#aaa', marginBottom: '2px' }}>Former / Oud-lid Trigger Waarde:</label>
                                            <input 
                                                type="text" 
                                                placeholder="Bijv. former of ex-member" 
                                                value={inputs.statusFormerVal} 
                                                onChange={e => updateLayerArrayInput(layer, 'statusFormerVal', e.target.value)}
                                                style={{ width: '100%', padding: '8px', background: '#222', border: '1px solid #444', color: '#fff', fontSize: '12px', borderRadius: '4px' }}
                                            />
                                        </div>

                                        <div style={{ marginBottom: '8px' }}>
                                            <label style={{ display: 'block', fontSize: '11px', color: '#aaa', marginBottom: '2px' }}>Alert / Gevaar Trigger Waarde:</label>
                                            <input 
                                                type="text" 
                                                placeholder="Bijv. injured of hiatus" 
                                                value={inputs.statusAlertVal} 
                                                onChange={e => updateLayerArrayInput(layer, 'statusAlertVal', e.target.value)}
                                                style={{ width: '100%', padding: '8px', background: '#222', border: '1px solid #444', color: '#fff', fontSize: '12px', borderRadius: '4px' }}
                                            />
                                        </div>

                                        <div style={{ marginBottom: '8px' }}>
                                            <label style={{ display: 'block', fontSize: '11px', color: '#aaa', marginBottom: '2px' }}>Warning / Waarschuwing Trigger Waarde:</label>
                                            <input 
                                                type="text" 
                                                placeholder="Bijv. military" 
                                                value={inputs.statusWarningVal} 
                                                onChange={e => updateLayerArrayInput(layer, 'statusWarningVal', e.target.value)}
                                                style={{ width: '100%', padding: '8px', background: '#222', border: '1px solid #444', color: '#fff', fontSize: '12px', borderRadius: '4px' }}
                                            />
                                        </div>

                                        <div style={{ marginBottom: '8px' }}>
                                            <label style={{ display: 'block', fontSize: '11px', color: '#aaa', marginBottom: '2px' }}>Info / Actief Trigger Waarde:</label>
                                            <input 
                                                type="text" 
                                                placeholder="Bijv. active" 
                                                value={inputs.statusInfoVal} 
                                                onChange={e => updateLayerArrayInput(layer, 'statusInfoVal', e.target.value)}
                                                style={{ width: '100%', padding: '8px', background: '#222', border: '1px solid #444', color: '#fff', fontSize: '12px', borderRadius: '4px' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div style={{ display: 'flex', gap: '15px', marginTop: '30px', borderTop: '1px solid #333', paddingTop: '20px' }}>
                        <button type="submit" style={{ padding: '12px 24px', background: '#deff9a', color: '#000', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                            {isNew ? 'Save New Theme' : 'Apply Settings Changes'}
                        </button>
                        <button type="button" onClick={() => setEditingTheme(null)} style={{ padding: '12px 24px', background: 'transparent', color: '#fff', border: '1px solid #555', borderRadius: '6px', cursor: 'pointer' }}>
                            Cancel
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}