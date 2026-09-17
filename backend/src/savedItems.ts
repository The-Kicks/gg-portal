import { Router, Request, Response } from 'express';
import { prisma } from './prisma';

const router = Router();

/**
 * POST /api/saved-items
 * Creates a new user saved item (e.g. game result, custom run, favorites)
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const { userId, themeId, type, name, data } = req.body;

        if (!userId || !type || !name) {
            return res.status(400).json({ error: "Missing required fields: userId, type, and name are strictly required." });
        }

        const newSavedItem = await prisma.userSavedItem.create({
            data: {
                userId,
                themeId: themeId || null,
                type,
                name,
                data: data || {}
            }
        });

        res.status(201).json(newSavedItem);
    } catch (error) {
        console.error("Error creating user saved item:", error);
        res.status(500).json({ error: "Internal server error while saving item." });
    }
});

/**
 * GET /api/saved-items/:userId
 * Retrieves all saved items for a specific user, optionally filtered by themeId or type via query parameters.
 */
router.get('/:userId', async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const { themeId, type } = req.query;

        const whereClause: Record<string, unknown> = { userId };
        if (themeId) whereClause.themeId = String(themeId);
        if (type) whereClause.type = String(type);

        const items = await prisma.userSavedItem.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' }
        });

        res.json(items);
    } catch (error) {
        console.error("Error fetching user saved items:", error);
        res.status(500).json({ error: "Internal server error while fetching saved items." });
    }
});

export default router;