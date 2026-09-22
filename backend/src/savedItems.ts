import { Router, Request, Response } from 'express';
import { prisma } from './prisma';

const router = Router();

/**
 * GET /api/saved-items
 * Retrieves saved items with optional query filters (userId, themeId, type)
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const { userId, themeId, type } = req.query;

        const whereClause: Record<string, unknown> = {};
        if (userId) whereClause.userId = String(userId);
        if (themeId) whereClause.themeId = String(themeId);
        if (type) whereClause.type = String(type);

        const items = await prisma.userSavedItem.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' }
        });

        res.json(items);
    } catch (error) {
        console.error("Error fetching saved items:", error);
        res.status(500).json({ error: "Internal server error while fetching saved items." });
    }
});

/**
 * POST /api/saved-items
 * Creates a new user saved item (or friend profile metadata)
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const { userId, themeId, type, name, data, username, friendUserId } = req.body;

        if (!userId || !type || (!name && type !== 'friend_profile')) {
            return res.status(400).json({ error: "Missing required fields." });
        }

        if (type === 'sorter_active' && themeId) {
            await prisma.userSavedItem.deleteMany({
                where: {
                    userId,
                    themeId,
                    type: 'sorter_active'
                }
            });
        }

        const itemData = (data && typeof data === 'object') ? { ...data } : {};
        if (username) itemData.username = username;
        if (friendUserId) itemData.friendUserId = friendUserId;

        const newSavedItem = await prisma.userSavedItem.create({
            data: {
                userId,
                themeId: themeId || null,
                type,
                name: name || (type === 'friend_profile' ? `Friend: ${username || friendUserId}` : 'Unnamed Item'),
                data: itemData
            }
        });

        res.status(201).json(newSavedItem);
    } catch (error) {
        console.error("Error creating user saved item:", error);
        res.status(500).json({ error: "Internal server error while saving item." });
    }
});

/**
 * PUT /api/saved-items/:id
 * Updates an existing user saved item
 */
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { themeId, type, name, data } = req.body;

        const existingItem = await prisma.userSavedItem.findUnique({
            where: { id }
        });

        if (!existingItem) {
            return res.status(404).json({ error: "Saved item not found." });
        }

        const updatedItem = await prisma.userSavedItem.update({
            where: { id },
            data: {
                themeId: themeId !== undefined ? themeId : existingItem.themeId,
                type: type !== undefined ? type : existingItem.type,
                name: name !== undefined ? name : existingItem.name,
                data: data !== undefined ? data : existingItem.data,
            }
        });

        res.json(updatedItem);
    } catch (error) {
        console.error("Error updating user saved item:", error);
        res.status(500).json({ error: "Internal server error while updating saved item." });
    }
});

/**
 * DELETE /api/saved-items/:id
 * Verwijdert een opgeslagen item
 */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const existingItem = await prisma.userSavedItem.findUnique({
            where: { id }
        });

        if (!existingItem) {
            return res.status(404).json({ error: "Saved item not found." });
        }

        await prisma.userSavedItem.delete({
            where: { id }
        });

        res.json({ success: true, message: "Saved item deleted successfully." });
    } catch (error) {
        console.error("Error deleting user saved item:", error);
        res.status(500).json({ error: "Internal server error while deleting saved item." });
    }
});

/**
 * GET /api/saved-items/:userId
 * Retrieves all saved items for a specific user
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