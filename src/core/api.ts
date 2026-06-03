// src/core/api.ts
import type { Theme, HydratedEntity } from '../types';

const API_URL = 'http://localhost:5000/api';

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
    return []; // Fallback naar een lege array als de server uit staat
  }
}

/**
 * Haalt alle gehydrateerde entiteiten (inclusief graph connections) op 
 * voor een specifiek thema en een specifieke laag (l1, l2, l3, l4, l5).
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
    return []; // Fallback naar een lege array bij een error
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
    const errorData = await response.json().catch(() => ({}));
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
    const errorData = await response.json().catch(() => ({}));
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
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Fout bij het verwijderen van het thema');
  }

  return await response.json() as { success: boolean; message: string };
}