import type { Theme, HydratedEntity } from '../types';

const API_URL = 'http://localhost:5000/api';

export interface GameResultData {
  result?: string;
  guessesCount?: number;
  hintsUsed?: number;
  gaveUp?: number;
  secretEntityName?: string;
  [key: string]: unknown;
}

export interface GameResultItem {
  id?: string;
  _id?: string;
  userId: string;
  themeId: string;
  type: string;
  name: string;
  data: GameResultData;
  createdAt?: string;
  username?: string;
  friendUserId?: string;
  [key: string]: unknown; 
}

/**
 * Haalt alle beschikbare portal-thema's op inclusief hun basisconfiguratie.
 */
export async function fetchThemes(): Promise<Theme[]> {
  try {
    const response = await fetch(`${API_URL}/themes`);
    if (!response.ok) {
      throw new Error('Netwerkrespons van de server was niet ok');
    }
    return await response.json() as Theme[];
  } catch (error) {
    console.error("Fout bij het ophalen van de thema's uit de database:", error);
    return []; 
  }
}

/**
 * Haalt alle gehydrateerde entiteiten op voor een specifiek thema en laag.
 */
export async function fetchEntitiesByLayer(themeId: string, layer: string): Promise<HydratedEntity[]> {
  try {
    const response = await fetch(`${API_URL}/entities/${themeId}/${layer}`);
    if (!response.ok) {
      throw new Error(`Netwerkrespons voor laag ${layer} was niet ok`);
    }
    return await response.json() as HydratedEntity[];
  } catch (error) {
    console.error(`Fout bij het ophalen van entiteiten voor ${themeId} op laag ${layer}:`, error);
    return []; 
  }
}

/**
 * Maakt een gloednieuw thema aan in de database.
 */
export async function createTheme(themeData: Partial<Theme>): Promise<Theme> {
  const response = await fetch(`${API_URL}/themes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(themeData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(errorData.error || 'Fout bij het aanmaken van het thema');
  }

  return await response.json() as Theme;
}

/**
 * Werkt de configuratie en stijlen van een bestaand thema bij.
 */
export async function updateTheme(id: string, themeData: Partial<Theme>): Promise<Theme> {
  const response = await fetch(`${API_URL}/themes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(themeData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(errorData.error || 'Fout bij het bijwerken van het thema');
  }

  return await response.json() as Theme;
}

/**
 * Verwijdert een thema en triggert een database cascade voor gekoppelde data.
 */
export async function deleteTheme(id: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_URL}/themes/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(errorData.error || 'Fout bij het verwijderen van het thema');
  }

  return await response.json() as { success: boolean; message: string };
}

/**
 * Slaat game-statistieken of opgeslagen items op in de database.
 */
export async function saveGameResult(payload: {
  userId: string;
  themeId: string;
  type: string;
  name: string;
  data: GameResultData;
}): Promise<GameResultItem> {
  const response = await fetch(`${API_URL}/saved-items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(errorData.error || 'Fout bij het opslaan van de game stats');
  }

  return await response.json() as GameResultItem;
}

/**
 * Haalt game-resultaten / opgeslagen items op uit de database voor een specifieke gebruiker.
 */
export async function getGameResults(params: {
  userId: string;
  themeId?: string;
  type?: string;
}): Promise<GameResultItem[]> {
  try {
    const queryParams = new URLSearchParams();
    if (params.themeId) queryParams.append('themeId', params.themeId);
    if (params.type) queryParams.append('type', params.type);

    const queryString = queryParams.toString();
    const url = `${API_URL}/saved-items/${params.userId}${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url);
    
    if (response.status === 404) {
      return [];
    }

    if (!response.ok) {
      throw new Error('Netwerkrespons bij het ophalen van game stats was niet ok');
    }
    return await response.json() as GameResultItem[];
  } catch (error) {
    console.error("Fout bij het ophalen van game results:", error);
    return [];
  }
}

/**
 * Haalt alle opgeslagen items op (met optionele filters zoals themeId en userId).
 */
export async function getAllSavedItems(params?: {
  userId?: string;
  themeId?: string;
  type?: string;
}): Promise<GameResultItem[]> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.userId) queryParams.append('userId', params.userId);
    if (params?.themeId) queryParams.append('themeId', params.themeId);
    if (params?.type) queryParams.append('type', params.type);

    const queryString = queryParams.toString();
    const url = `${API_URL}/saved-items${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Fout bij het ophalen van opgeslagen items');
    }
    return await response.json() as GameResultItem[];
  } catch (error) {
    console.error("Fout bij getAllSavedItems:", error);
    return [];
  }
}

/**
 * Maakt een nieuw opgeslagen item aan in de database.
 */
export async function createUserSavedItem(payload: {
  userId: string;
  themeId?: string;
  type: string;
  name: string;
  data: Record<string, unknown>;
  username?: string;
  friendUserId?: string;
}): Promise<GameResultItem> {
  const response = await fetch(`${API_URL}/saved-items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(errorData.error || 'Fout bij het opslaan van item');
  }

  return await response.json() as GameResultItem;
}

/**
 * Werkt een bestaand opgeslagen item bij in de database via PUT.
 */
export async function updateUserSavedItem(id: string, payload: {
  themeId?: string;
  type?: string;
  name?: string;
  data?: Record<string, unknown>;
}): Promise<GameResultItem> {
  const response = await fetch(`${API_URL}/saved-items/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(errorData.error || 'Fout bij het bijwerken van item');
  }

  return await response.json() as GameResultItem;
}

/**
 * Verwijdert een opgeslagen item uit de database op basis van ID.
 */
export async function deleteUserSavedItem(id: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_URL}/saved-items/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(errorData.error || 'Fout bij het verwijderen van item');
  }

  return await response.json() as { success: boolean; message: string };
}