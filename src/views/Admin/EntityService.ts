import type { HydratedEntity, BaseEntity } from '../../types';

const API_BASE_URL = 'http://localhost:5000/api'; // Pas aan naar jouw poort indien nodig

export const entityService = {

  // Controleer of een specifieke Entity ID al bestaat in de database
  checkIdExists: async (themeId: string, entityId: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/themes/${themeId}/entities/check/${entityId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        // Als de server om wat voor reden dan ook faalt, loggen we het en gaan we uit van 'false' (fallback)
        console.warn(`ID-check mislukt met status ${response.status}. Fallback naar false.`);
        return false;
      }

      const data = await response.json() as { exists: boolean };
      return data.exists;
    } catch (error) {
      console.error("Netwerkfout tijdens het controleren van de Entity ID:", error);
      return false;
    }
  },
  
  // Update een entiteit en zijn relaties
  update: async (themeId: string, entityId: string, entityData: HydratedEntity): Promise<{ success: boolean; message: string }> => {
    const response = await fetch(`${API_BASE_URL}/themes/${themeId}/entities/${entityId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entityData),
    });

    if (!response.ok) {
      throw new Error(`Server reageerde met status ${response.status} tijdens update.`);
    }
    return response.json();
  },

  // Maak direct een skeleton entiteit aan in de DB via Quick Create
  create: async (themeId: string, entityData: BaseEntity): Promise<HydratedEntity> => {
    const response = await fetch(`${API_BASE_URL}/themes/${themeId}/entities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entityData),
    });

    if (!response.ok) {
      throw new Error(`Server reageerde met status ${response.status} tijdens creatie.`);
    }
    return response.json();
  }
  
};