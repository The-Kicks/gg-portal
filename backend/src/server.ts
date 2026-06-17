import express, { Request, Response } from 'express';
import cors from 'cors';
import { PrismaClient, Prisma } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

app.use(cors());

// Increase the text/json payload limit to allow large theme graphs or embedded assets
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

interface EntityImages {
    profileCard: string;
    heroBanner: string;
    [key: string]: unknown;
}

interface ConnectionMetadata {
    role?: string;
    status: string;
    startDate?: string;
    endDate?: string;
    hideFromGrid?: boolean;
    [key: string]: unknown;
}

interface BaseEntity {
    id: string;
    themeId: string;
    name: string;
    type: string;
    status?: string;
    isStandalone: boolean;
    image: EntityImages;
    metadata: Record<string, unknown>;
}

interface HydratedEntityConnection {
    id: string;
    themeId: string;
    sourceEntityId: string;
    targetEntityId: string;
    metadata: ConnectionMetadata;
    sourceEntity?: BaseEntity;
    targetEntity?: BaseEntity;
}

interface HydratedEntity extends BaseEntity {
    connections: HydratedEntityConnection[];
    targetConnections: HydratedEntityConnection[];
}

interface MetaDataStandard {
    badgeKey: string;
    subtitleKey: string;
    gridKeys: string[];
    statusTriggers?: Record<string, unknown>;
}

interface GuessWhoSettings {
    disabledColumns: string[];
}

interface BlindRankingSettings {
    availableCategories: string[];
    disabledCategories: string[];
}

interface GameSettings {
    guesswho?: GuessWhoSettings;
    blindranking?: BlindRankingSettings;
    [key: string]: unknown;
}

interface FullThemeResponse {
    id: string;
    title: string;
    description: string | null;
    orgLayer: string;
    miniViewLayers: string[];
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    navbarColor: string;
    textColor: string;
    darkPrimaryColor: string;
    darkSecondaryColor: string;
    darkBackgroundColor: string;
    darkTextColor: string;
    darkNavbarColor: string;
    games: string[];
    navbarItems: string[];
    labels: Record<string, string | undefined>;
    layerMetadata: Record<string, MetaDataStandard | undefined>;
    gameSettings: GameSettings; // Combined game settings response for the frontend
    entities: HydratedEntity[];
}

// Interface om de linter waarschuwing in de GET route op te lossen
interface VirtualTrackStructure {
    name?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    milestones?: string;
}

// --- ROUTES ---

app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: "Backend up and running!" });
});

// --- THEME ROUTES (GET, POST, PUT, DELETE) ---

app.get('/api/themes', async (_req: Request, res: Response) => {
    try {
        const themes = await prisma.theme.findMany();
        const fullThemesResult: FullThemeResponse[] = [];

        for (const theme of themes) {
            // 1. Fetch data from linked tables
            const dbEntities = await prisma.entity.findMany({
                where: { themeId: theme.id }
            });

            const dbConnections = await prisma.entityConnection.findMany({
                where: { themeId: theme.id }
            });

            // Fetch ALL rows for this theme (e.g., 'guesswho' AND 'blindranking')
            const dbGameSettings = await prisma.gameSetting.findMany({
                where: { themeId: theme.id }
            });

            // Reconstruct individual rows into a single combined frontend object
            const combinedGameSettings: GameSettings = {};
            dbGameSettings.forEach((setting) => {
                combinedGameSettings[setting.gameName] = setting.gameSettings as unknown as Record<string, unknown>;
            });

            // 2. Map database records to initial HydratedEntity objects
            const hydratedEntities: HydratedEntity[] = dbEntities.map((e) => {
                const entityMetadata = (e.metadata || {}) as Record<string, unknown>;
                const extractedStatus = e.status
                    ? e.status
                    : (typeof entityMetadata.status === 'string' ? entityMetadata.status : 'active');

                // RECONSTRUCTIE VAN VIRTUELE TRACKS VOOR DE FRONTEND
                const frontendConnections: HydratedEntityConnection[] = [];

                // Als er customTracks in de metadata staan, bouwen we ze om naar connectie-objecten
                if (Array.isArray(entityMetadata.customTracks)) {
                    // TYPE-SAFE: track gebruikt nu VirtualTrackStructure i.p.v. any
                    (entityMetadata.customTracks as VirtualTrackStructure[]).forEach((track) => {
                        const trackName = track.name || 'Custom Track';
                        // Zorg voor een unieke en herkenbare ID die matcht met de frontend (virtual-track:naam)
                        const trackId = `virtual-track:${trackName.toLowerCase().replace(/\s+/g, '-')}`;

                        frontendConnections.push({
                            id: trackId,
                            themeId: e.themeId,
                            sourceEntityId: e.id,
                            targetEntityId: trackId,
                            metadata: {
                                status: track.status || 'active',
                                startDate: track.startDate || '',
                                endDate: track.endDate || '',
                                milestones: track.milestones || '',
                                customTargetName: trackName, // Belangrijk voor het tonen van de naam
                                isNonRelational: true        // Zodat de frontend weet dat dit een track is
                            }
                        });
                    });
                }

                return {
                    id: e.id,
                    themeId: e.themeId,
                    name: e.name,
                    type: e.type,
                    status: extractedStatus,
                    isStandalone: e.isStandalone,
                    image: (e.image || { profileCard: '', heroBanner: '' }) as unknown as EntityImages,
                    metadata: entityMetadata,
                    connections: frontendConnections, // Vul alvast met de virtuele connecties
                    targetConnections: []
                };
            });

            const entityMap = new Map<string, HydratedEntity>(
                hydratedEntities.map((e) => [e.id, e])
            );

            // 3. Hydrate all edges (connections) between the graph nodes
            for (const conn of dbConnections) {
                const source = entityMap.get(conn.sourceEntityId);
                const target = entityMap.get(conn.targetEntityId);

                const baseSource: BaseEntity | undefined = source ? {
                    id: source.id,
                    themeId: source.themeId,
                    name: source.name,
                    type: source.type,
                    status: source.status,
                    isStandalone: source.isStandalone,
                    image: source.image,
                    metadata: source.metadata
                } : undefined;

                const baseTarget: BaseEntity | undefined = target ? {
                    id: target.id,
                    themeId: target.themeId,
                    name: target.name,
                    type: target.type,
                    status: target.status,
                    isStandalone: target.isStandalone,
                    image: target.image,
                    metadata: target.metadata
                } : undefined;

                const hydratedConn: HydratedEntityConnection = {
                    id: conn.id,
                    themeId: conn.themeId,
                    sourceEntityId: conn.sourceEntityId,
                    targetEntityId: conn.targetEntityId,
                    metadata: (conn.metadata || { status: 'active' }) as unknown as ConnectionMetadata,
                    sourceEntity: baseSource,
                    targetEntity: baseTarget
                };

                if (source) source.connections.push(hydratedConn);
                if (target) target.targetConnections.push(hydratedConn);
            }

            // 4. Construct the complete theme payload
            fullThemesResult.push({
                id: theme.id,
                title: theme.title,
                description: theme.description,
                orgLayer: theme.orgLayer,
                miniViewLayers: (theme.miniViewLayers || []) as unknown as string[],
                primaryColor: theme.primaryColor,
                secondaryColor: theme.secondaryColor,
                backgroundColor: theme.backgroundColor,
                navbarColor: theme.navbarColor,
                textColor: theme.textColor,
                darkPrimaryColor: theme.darkPrimaryColor ?? theme.primaryColor,
                darkSecondaryColor: theme.darkSecondaryColor ?? theme.secondaryColor,
                darkBackgroundColor: theme.darkBackgroundColor ?? theme.backgroundColor,
                darkTextColor: theme.darkTextColor ?? theme.textColor,
                darkNavbarColor: theme.darkNavbarColor ?? theme.navbarColor,
                games: (theme.games || []) as unknown as string[],
                navbarItems: (theme.navbarItems || []) as unknown as string[],
                labels: (theme.labels || {}) as Record<string, string | undefined>,
                layerMetadata: (theme.layerMetadata || {}) as Record<string, MetaDataStandard | undefined>,
                gameSettings: combinedGameSettings,
                entities: hydratedEntities
            });
        }

        res.json(fullThemesResult);
    } catch (error) {
        console.error("Error building typed graph dataset:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get('/api/themes/:themeId/entities/check/:entityId', async (req: Request, res: Response) => {
    const { entityId } = req.params;
    try {
        const existingEntity = await prisma.entity.findUnique({
            where: { id: entityId }
        });
        res.json({ exists: !!existingEntity });
    } catch (error) {
        console.error("Error checking entity ID existence:", error);
        res.status(500).json({ error: "Could not execute ID check" });
    }
});

app.post('/api/themes', async (req: Request, res: Response) => {
    try {
        const {
            id, title, description, orgLayer, miniViewLayers,
            primaryColor, secondaryColor, backgroundColor, navbarColor, textColor,
            darkPrimaryColor, darkSecondaryColor, darkBackgroundColor, darkTextColor, darkNavbarColor,
            games, navbarItems, labels, layerMetadata, gameSettings
        } = req.body;

        // Map gameSettings keys (guesswho, blindranking, etc.) to individual creation promises
        const gameSettingCreates = Object.entries(gameSettings || {}).map(([gameName, settings]) =>
            prisma.gameSetting.create({
                data: {
                    themeId: id,
                    gameName: gameName,
                    gameSettings: (settings || {}) as Prisma.InputJsonValue
                }
            })
        );

        const [newTheme] = await prisma.$transaction([
            prisma.theme.create({
                data: {
                    id, title, description, orgLayer,
                    miniViewLayers: miniViewLayers as Prisma.InputJsonValue,
                    primaryColor, secondaryColor, backgroundColor, navbarColor, textColor,
                    darkPrimaryColor, darkSecondaryColor, darkBackgroundColor, darkTextColor, darkNavbarColor,
                    games: games as Prisma.InputJsonValue,
                    navbarItems: navbarItems as Prisma.InputJsonValue,
                    labels: labels as Prisma.InputJsonValue,
                    layerMetadata: layerMetadata as Prisma.InputJsonValue
                }
            }),
            ...gameSettingCreates
        ]);

        res.status(201).json(newTheme);
    } catch (error) {
        console.error("Error creating theme and game settings:", error);
        res.status(500).json({ error: "Could not create theme. Does this ID already exist?" });
    }
});

app.put('/api/themes/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const {
            title, description, orgLayer, miniViewLayers,
            primaryColor, secondaryColor, backgroundColor, navbarColor, textColor,
            darkPrimaryColor, darkSecondaryColor, darkBackgroundColor, darkTextColor, darkNavbarColor,
            games, navbarItems, labels, layerMetadata, gameSettings
        } = req.body;

        // To avoid orphan records, clear old settings first and insert current active games fresh inside the transaction
        const gameSettingCreates = Object.entries(gameSettings || {}).map(([gameName, settings]) =>
            prisma.gameSetting.create({
                data: {
                    themeId: id,
                    gameName: gameName,
                    gameSettings: (settings || {}) as Prisma.InputJsonValue
                }
            })
        );

        const [updatedTheme] = await prisma.$transaction([
            prisma.theme.update({
                where: { id },
                data: {
                    title, description, orgLayer,
                    miniViewLayers: miniViewLayers as Prisma.InputJsonValue,
                    primaryColor, secondaryColor, backgroundColor, navbarColor, textColor,
                    darkPrimaryColor, darkSecondaryColor, darkBackgroundColor, darkTextColor, darkNavbarColor,
                    games: games as Prisma.InputJsonValue,
                    navbarItems: navbarItems as Prisma.InputJsonValue,
                    labels: labels as Prisma.InputJsonValue,
                    layerMetadata: layerMetadata as Prisma.InputJsonValue
                }
            }),
            prisma.gameSetting.deleteMany({
                where: { themeId: id }
            }),
            ...gameSettingCreates
        ]);

        res.json(updatedTheme);
    } catch (error) {
        console.error("Error updating theme and game settings:", error);
        res.status(500).json({ error: "Could not update theme layout." });
    }
});

app.delete('/api/themes/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        await prisma.$transaction([
            prisma.gameSetting.deleteMany({ where: { themeId: id } }),
            prisma.theme.delete({ where: { id } })
        ]);

        res.json({ success: true, message: "Theme and all cascading entities/connections successfully removed." });
    } catch (error) {
        console.error("Error deleting theme graph:", error);
        res.status(500).json({ error: "Could not delete the selected theme." });
    }
});

// --- ENTITY ROUTES (CREATE & UPDATE) ---

type UpdateEntityResponse = { success: boolean; message: string } | { error: string };

app.put(
    '/api/themes/:themeId/entities/:entityId',
    async (req: Request<{ themeId: string; entityId: string }, UpdateEntityResponse, HydratedEntity>, res: Response<UpdateEntityResponse>) => {
        const { themeId, entityId } = req.params;
        const { name, type, status, isStandalone, image, metadata, connections } = req.body;

        try {
            const safeConnections = connections || [];

            // 1. Vis de virtuele tracks (zoals Sixteen) eruit om ze in de metadata te redden
            const virtualTracks = safeConnections.filter(conn => {
                const targetId = conn.targetEntityId || conn.id;
                return targetId && targetId.startsWith('virtual-track:');
            });

            // Bouw een schone lijst op van de custom track namen/data
            const customTracksData = virtualTracks.map(track => {
                const t = track as typeof track & { direction?: string };
                return {
                    name: t.metadata?.customTargetName || t.id.replace('virtual-track:', ''),
                    startDate: t.metadata?.startDate || '',
                    endDate: t.metadata?.endDate || '',
                    status: t.metadata?.status || 'active',
                    milestones: t.metadata?.milestones || ''
                };
            });

            // Voeg de custom tracks toe aan het bestaande metadata object
            const updatedMetadata = {
                ...(metadata || {}),
                customTracks: customTracksData
            };

            // 2. Filter de ECHTE database-connecties (alleen uitgaand, om je relaties naar boven niet te slopen)
            const connectionsToInsert = safeConnections
                .filter(conn => {
                    const targetId = conn.targetEntityId || conn.id;
                    const frontendConn = conn as typeof conn & { direction?: string };

                    // Sla virtuele tracks én inkomende relaties over voor de koppeltabel
                    return targetId && !targetId.startsWith('virtual-track:') && frontendConn.direction !== 'incoming';
                })
                .map((conn) => {
                    return {
                        themeId,
                        sourceEntityId: entityId,
                        targetEntityId: conn.targetEntityId || conn.id,
                        metadata: (conn.metadata || { status: 'active' }) as unknown as Prisma.InputJsonValue
                    };
                });

            await prisma.$transaction([
                // Update de basisgegevens inclusief de NIEUWE aangepaste metadata
                prisma.entity.update({
                    where: { id: entityId },
                    data: {
                        name,
                        type,
                        status: status || 'active',
                        isStandalone,
                        image: image as unknown as Prisma.InputJsonValue,
                        metadata: updatedMetadata as Prisma.InputJsonValue,
                    }
                }),

                // Schoon alleen je eigen uitgaande connecties op
                prisma.entityConnection.deleteMany({
                    where: {
                        themeId,
                        sourceEntityId: entityId
                    }
                }),

                // Voeg de legitieme database connecties toe
                prisma.entityConnection.createMany({
                    data: connectionsToInsert
                })
            ]);

            res.json({ success: true, message: "Entity graph and virtual tracks synchronized successfully." });
        } catch (error) {
            console.error("Error updating graph entity and relationships:", error);
            res.status(500).json({ error: "Internal server error during update." });
        }
    }
);

app.listen(PORT, () => {
    console.log(`🚀 GG-PORTAL backend server running on http://localhost:${PORT}`);
});