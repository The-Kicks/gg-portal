/**
 * HOOK: useAdminTheme.ts
 * Doel: Beheert de state en logica voor het bewerken en opslaan van thema-instellingen.
 * Functies: Afhandeling van form-input, API-calls voor CRUD-acties op thema's,
 * en het vertalen van ruwe metadata naar de vereiste systeem-structuur.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTheme, updateTheme, deleteTheme } from '../../../core/api';
import type { GuessWhoColumnID } from '../../../core/gamesConfig';
import type { Theme, MetaDataStandard } from '../../../types';

const FIXED_STATUS_KEY = 'status'; 
const AVAILABLE_LAYERS = ['l1', 'l2', 'l3', 'l4'];

export interface MetaInputState {
    gridKeys: string;
    mediaKeys: string; 
    statusFormerVal: string;
    statusAlertVal: string;
    statusWarningVal: string;
    statusInfoVal: string;
}

const emptyTheme: Partial<Theme> = {
    id: '', title: '', description: '', orgLayer: 'l3',
    miniViewLayers: ['l1'], games: ['sorter'], navbarItems: ['l4', 'l3', 'l1'],
    labels: { l1: 'Industry', l2: 'Label', l3: 'Group', l4: 'Driver' },
    layerMetadata: {},
    gameSettings: { guesswho: { disabledColumns: [] } }
};

export function useAdminTheme(onRefresh: () => Promise<void>, themeName?: string) {
    const navigate = useNavigate();
    const [editingTheme, setEditingTheme] = useState<Partial<Theme> | null>(null);
    const [isNew, setIsNew] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [metaInputs, setMetaInputs] = useState<Record<string, MetaInputState>>({});
    const [guesswhoDisabledColumns, setGuesswhoDisabledColumns] = useState<GuessWhoColumnID[]>([]);

    const handleReturnToControlPanel = () => {
        navigate(`/${themeName || 'default'}/admin`);
    };

    const handleStartCreate = () => {
        const initialMetaInputs: Record<string, MetaInputState> = {};
        AVAILABLE_LAYERS.forEach(layer => {
            initialMetaInputs[layer] = {
                gridKeys: layer === 'l4' ? 'Birthday, Nationality' : '',
                mediaKeys: '', 
                statusFormerVal: '', statusAlertVal: '', statusWarningVal: '', statusInfoVal: ''
            };
        });
        setMetaInputs(initialMetaInputs);
        setGuesswhoDisabledColumns([]);
        setEditingTheme({
            ...emptyTheme,
            layerMetadata: { 
                l4: { 
                    badgeKey: 'Role', 
                    subtitleKey: 'Group', 
                    gridKeys: ['Birthday', 'Nationality'],
                    mediaKeys: [] 
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
        setGuesswhoDisabledColumns(theme.gameSettings?.guesswho?.disabledColumns || []);

        const initialMetaInputs: Record<string, MetaInputState> = {};
        const layerMetadataRecord = (theme.layerMetadata || {}) as Record<string, MetaDataStandard>;

        AVAILABLE_LAYERS.forEach(layer => {
            const layerData = layerMetadataRecord[layer];
            initialMetaInputs[layer] = {
                gridKeys: layerData?.gridKeys ? layerData.gridKeys.join(', ') : '',
                mediaKeys: layerData?.mediaKeys ? layerData.mediaKeys.join(', ') : '',
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
        } catch (err) {
            alert(err instanceof Error ? err.message : 'An unidentified infrastructure failure occurred.');
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

            // Split string op komma's, trim witruimtes en filter lege waarden eruit
            const gridKeysArr = inputs.gridKeys.split(',').map(s => s.trim()).filter(Boolean);
            const mediaKeysArr = inputs.mediaKeys.split(',').map(s => s.trim()).filter(Boolean);
            
            const statusTriggers: NonNullable<MetaDataStandard['statusTriggers']> = {};

            if (inputs.statusFormerVal) statusTriggers.former = { key: FIXED_STATUS_KEY, value: inputs.statusFormerVal };
            if (inputs.statusAlertVal) statusTriggers.alert = { key: FIXED_STATUS_KEY, value: inputs.statusAlertVal };
            if (inputs.statusWarningVal) statusTriggers.warning = { key: FIXED_STATUS_KEY, value: inputs.statusWarningVal };
            if (inputs.statusInfoVal) statusTriggers.info = { key: FIXED_STATUS_KEY, value: inputs.statusInfoVal };

            const badgeKey = layerData?.badgeKey || '';
            const subtitleKey = layerData?.subtitleKey || '';

            // Neem de laag mee als er minimaal één relevante eigenschap is ingevuld (inclusief mediaKeys)
            if (badgeKey || subtitleKey || gridKeysArr.length || mediaKeysArr.length || Object.keys(statusTriggers).length > 0) {
                finalLayerMetadata[layer] = {
                    badgeKey, 
                    subtitleKey, 
                    gridKeys: gridKeysArr,
                    mediaKeys: mediaKeysArr, 
                    ...(Object.keys(statusTriggers).length > 0 ? { statusTriggers } : {})
                };
            }
        });

        const payload = {
            ...editingTheme,
            layerMetadata: finalLayerMetadata,
            gameSettings: {
                ...(editingTheme.gameSettings || {}),
                guesswho: { disabledColumns: guesswhoDisabledColumns }
            }
        };

        try {
            if (isNew) {
                await createTheme(payload as Theme);
            } else {
                await updateTheme(editingTheme.id, payload as Theme);
            }
            setEditingTheme(null);
            window.dispatchEvent(new Event('refresh-database'));
            await onRefresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred during save execution.');
        }
    };

    const updateLabel = (key: string, val: string) => {
        if (!editingTheme) return;
        setEditingTheme({ ...editingTheme, labels: { ...(editingTheme.labels || {}), [key]: val } });
    };

    const updateLayerString = (layer: string, key: 'badgeKey' | 'subtitleKey', val: string) => {
        if (!editingTheme) return;
        const currentMeta = { ...((editingTheme.layerMetadata || {}) as Record<string, MetaDataStandard>) };
        const baseLayer = currentMeta[layer] || { badgeKey: '', subtitleKey: '', gridKeys: [] };
        currentMeta[layer] = { ...baseLayer, [key]: val };
        setEditingTheme({ ...editingTheme, layerMetadata: currentMeta });
    };

    const updateLayerArrayInput = (layer: string, key: keyof MetaInputState, val: string) => {
        setMetaInputs(prev => ({ ...prev, [layer]: { ...prev[layer], [key]: val } }));
    };

    const handleArrayToggle = (field: 'miniViewLayers' | 'games' | 'navbarItems', value: string) => {
        if (!editingTheme) return;
        const currentArray = (editingTheme[field] as string[]) || [];
        const newArray = currentArray.includes(value) ? currentArray.filter(item => item !== value) : [...currentArray, value];
        setEditingTheme({ ...editingTheme, [field]: newArray });
    };

    const handleGuessWhoColumnToggle = (columnId: GuessWhoColumnID) => {
        setGuesswhoDisabledColumns(prev => prev.includes(columnId) ? prev.filter(id => id !== columnId) : [...prev, columnId]);
    };

    return {
        handleReturnToControlPanel, editingTheme, isNew, error, metaInputs, guesswhoDisabledColumns, setEditingTheme,
        handleStartCreate, handleStartEdit, handleDelete, handleSave,
        updateLabel, updateLayerString, updateLayerArrayInput, handleArrayToggle, handleGuessWhoColumnToggle
    };
}