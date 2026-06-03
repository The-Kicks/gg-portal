import express, { Request, Response } from 'express';
import cors from 'cors';
import { PrismaClient, Prisma } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


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
    id: number;
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
    entities: HydratedEntity[];
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
            // 1. Haal alle platte entiteiten en connecties op voor dit specifieke thema
            const dbEntities = await prisma.entity.findMany({
                where: { themeId: theme.id }
            });

            const dbConnections = await prisma.entityConnection.findMany({
                where: { themeId: theme.id }
            });

            // 2. Map DB-data naar initiële HydratedEntity objecten
            const hydratedEntities: HydratedEntity[] = dbEntities.map((e) => {
                const entityMetadata = (e.metadata || {}) as Record<string, unknown>;

                // 🌟 Kijk eerst naar de echte database kolom 'e.status'
                const extractedStatus = e.status
                    ? e.status
                    : (typeof entityMetadata.status === 'string' ? entityMetadata.status : 'active');

                return {
                    id: e.id,
                    themeId: e.themeId,
                    name: e.name,
                    type: e.type,
                    status: extractedStatus, // Nu pakt hij keurig 'disbanded' uit de database!
                    isStandalone: e.isStandalone,
                    image: (e.image || { profileCard: '', heroBanner: '' }) as unknown as EntityImages,
                    metadata: entityMetadata,
                    connections: [],
                    targetConnections: []
                };
            });

            // Maak een snelle Map voor O(1) opzoeken tijdens het hydrateren
            const entityMap = new Map<string, HydratedEntity>(
                hydratedEntities.map((e) => [e.id, e])
            );

            // 3. Hydrateer alle edges (verbindingen) tussen de knopen
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

                // Voeg toe aan uitgaande connecties van de bron (bv. Rijder -> Team)
                if (source) source.connections.push(hydratedConn);

                // Voeg toe aan inkomende connecties van het doel (bv. Team <- Rijder)
                if (target) target.targetConnections.push(hydratedConn);
            }

            // 4. Voeg het gecompleteerde thema toe aan het eindresultaat
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
                entities: hydratedEntities
            });
        }

        res.json(fullThemesResult);
    } catch (error) {
        console.error("Fout bij opbouwen van getypeerde graph dataset:", error);
        res.status(500).json({ error: "Interne serverfout" });
    }
});

app.get('/api/themes/:themeId/entities/check/:entityId', async (req: Request, res: Response) => {
    const { entityId } = req.params;
    try {
        const existingEntity = await prisma.entity.findUnique({
            where: { id: entityId }
        });
        
        // Als existingEntity bestaat sturen we 'exists: true', anders 'false'
        res.json({ exists: !!existingEntity });
    } catch (error) {
        console.error("Fout bij controleren ID:", error);
        res.status(500).json({ error: "Kon ID-controle niet uitvoeren" });
    }
});

app.post('/api/themes', async (req: Request, res: Response) => {
    try {
        const {
            id, title, description, orgLayer, miniViewLayers,
            primaryColor, secondaryColor, backgroundColor, navbarColor, textColor,
            darkPrimaryColor, darkSecondaryColor, darkBackgroundColor, darkTextColor, darkNavbarColor,
            games, navbarItems, labels, layerMetadata
        } = req.body;

        const newTheme = await prisma.theme.create({
            data: {
                id,
                title,
                description,
                orgLayer,
                miniViewLayers: miniViewLayers as Prisma.InputJsonValue,
                primaryColor,
                secondaryColor,
                backgroundColor,
                navbarColor,
                textColor,
                darkPrimaryColor,
                darkSecondaryColor,
                darkBackgroundColor,
                darkTextColor,
                darkNavbarColor,
                games: games as Prisma.InputJsonValue,
                navbarItems: navbarItems as Prisma.InputJsonValue,
                labels: labels as Prisma.InputJsonValue,
                layerMetadata: layerMetadata as Prisma.InputJsonValue
            }
        });

        res.status(201).json(newTheme);
    } catch (error) {
        console.error("Fout bij aanmaken thema:", error);
        res.status(500).json({ error: "Kon het thema niet aanmaken. Bestaat deze ID al?" });
    }
});

app.put('/api/themes/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const {
            title, description, orgLayer, miniViewLayers,
            primaryColor, secondaryColor, backgroundColor, navbarColor, textColor,
            darkPrimaryColor, darkSecondaryColor, darkBackgroundColor, darkTextColor, darkNavbarColor,
            games, navbarItems, labels, layerMetadata
        } = req.body;

        const updatedTheme = await prisma.theme.update({
            where: { id },
            data: {
                title,
                description,
                orgLayer,
                miniViewLayers: miniViewLayers as Prisma.InputJsonValue,
                primaryColor,
                secondaryColor,
                backgroundColor,
                navbarColor,
                textColor,
                darkPrimaryColor,
                darkSecondaryColor,
                darkBackgroundColor,
                darkTextColor,
                darkNavbarColor,
                games: games as Prisma.InputJsonValue,
                navbarItems: navbarItems as Prisma.InputJsonValue,
                labels: labels as Prisma.InputJsonValue,
                layerMetadata: layerMetadata as Prisma.InputJsonValue
            }
        });

        res.json(updatedTheme);
    } catch (error) {
        console.error("Fout bij updaten thema:", error);
        res.status(500).json({ error: "Kon het thema niet bijwerken." });
    }
});

app.delete('/api/themes/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        await prisma.theme.delete({
            where: { id }
        });
        res.json({ success: true, message: "Thema en alle gekoppelde entiteiten/connecties succesvol verwijderd." });
    } catch (error) {
        console.error("Fout bij verwijderen thema:", error);
        res.status(500).json({ error: "Kon het thema niet verwijderen." });
    }
});

// --- ENTITY ROUTES (CREATE & UPDATE) ---

type CreateEntityResponse = HydratedEntity | { error: string };

app.post(
    '/api/themes/:themeId/entities', 
    async (req: Request<{ themeId: string }, CreateEntityResponse, BaseEntity>, res: Response<CreateEntityResponse>) => {
        const { themeId } = req.params;
        const { id, name, type, status, isStandalone, image, metadata } = req.body;

        try {
            const newEntity = await prisma.entity.create({
                data: {
                    id,
                    themeId,
                    name,
                    type,
                    status: status || 'active',
                    isStandalone,
                    image: image as unknown as Prisma.InputJsonValue,
                    metadata: metadata as Prisma.InputJsonValue,
                }
            });

            const responsePayload: HydratedEntity = {
                ...newEntity,
                status: newEntity.status || 'active',
                image: newEntity.image as unknown as EntityImages,
                metadata: newEntity.metadata as Record<string, unknown>,
                connections: [],
                targetConnections: []
            };

            res.status(201).json(responsePayload);
        } catch (error) {
            console.error("Fout bij aanmaken entiteit:", error);
            res.status(500).json({ error: "Kon entiteit niet aanmaken" });
        }
    }
);

type UpdateEntityResponse = { success: boolean; message: string } | { error: string };

app.put(
    '/api/themes/:themeId/entities/:entityId', 
    async (req: Request<{ themeId: string; entityId: string }, UpdateEntityResponse, HydratedEntity>, res: Response<UpdateEntityResponse>) => {
        const { themeId, entityId } = req.params;
        const { name, type, status, isStandalone, image, metadata, connections } = req.body;

        try {
            await prisma.$transaction([
                prisma.entity.update({
                    where: { id: entityId },
                    data: {
                        name,
                        type,
                        status: status || 'active',
                        isStandalone,
                        image: image as unknown as Prisma.InputJsonValue,
                        metadata: metadata as Prisma.InputJsonValue,
                    }
                }),

                prisma.entityConnection.deleteMany({
                    where: {
                        themeId,
                        sourceEntityId: entityId
                    }
                }),

                prisma.entityConnection.createMany({
                    data: connections.map((conn) => ({
                        themeId,
                        sourceEntityId: entityId,
                        targetEntityId: conn.targetEntityId,
                        metadata: conn.metadata as unknown as Prisma.InputJsonValue
                    }))
                })
            ]);

            res.json({ success: true, message: "Entiteit succesvol gesynchroniseerd." });
        } catch (error) {
            console.error("Fout bij bijwerken van getypeerde graph:", error);
            res.status(500).json({ error: "Interne serverfout bij updaten" });
        }
    }
);

app.listen(PORT, () => {
    console.log(`🚀 GG-PORTAL backend server draait op http://localhost:${PORT}`);
});