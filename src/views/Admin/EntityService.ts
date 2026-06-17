import type { HydratedEntity, BaseEntity } from '../../types';

const API_BASE_URL = 'http://localhost:5000/api'; 

export const entityService = {

  /**
   * Check if a specific Entity ID already exists within a theme database.
   */
  checkIdExists: async (themeId: string, entityId: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/themes/${themeId}/entities/check/${entityId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        console.warn(`ID check failed with status ${response.status}. Falling back to false.`);
        return false;
      }

      const data = await response.json() as { exists: boolean };
      return data.exists;
    } catch (error) {
      console.error("Network error while checking Entity ID:", error);
      return false;
    }
  },
  
  /**
   * Update an entity and its timeline relationships.
   */
  update: async (themeId: string, entityId: string, entityData: HydratedEntity): Promise<{ success: boolean; message: string }> => {
    const response = await fetch(`${API_BASE_URL}/themes/${themeId}/entities/${entityId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entityData),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status} during update.`);
    }
    return response.json() as Promise<{ success: boolean; message: string }>;
  },

  /**
   * Create a skeleton entity directly in the database via Quick Create.
   */
  create: async (themeId: string, entityData: BaseEntity): Promise<HydratedEntity> => {
    const response = await fetch(`${API_BASE_URL}/themes/${themeId}/entities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entityData),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status} during creation.`);
    }
    return response.json() as Promise<HydratedEntity>;
  }
  
};