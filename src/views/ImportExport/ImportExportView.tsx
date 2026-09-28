import React, { useState } from 'react';
import type { ChangeEvent } from 'react';
import type { Theme } from '../../types';
import { getAllSavedItems, createUserSavedItem, type GameResultItem } from '../../core/api';
import styles from './ImportExportView.module.css';

interface ImportExportViewProps {
  theme: Theme;
  userId: string;
}

interface ExportPackage {
  version: string;
  themeId: string;
  userId: string;
  username: string;
  exportedAt: string;
  items: GameResultItem[];
}

interface EntityImages {
  profileCard?: string;
  heroBanner?: string;
  [key: string]: unknown;
}

interface EntityItem {
  id: string;
  themeId: string;
  name: string;
  type: string;
  status?: string;
  isStandalone?: boolean;
  image?: EntityImages;
  metadata?: Record<string, unknown>;
  connections?: unknown[];
}

interface EntityExportPackage {
  version: string;
  themeId: string;
  exportedAt: string;
  entities: EntityItem[];
}

interface NewMediaItem {
  url: string;
  entityName: string;
  category: string;
}

interface UserProfile {
  username?: string;
}

export const ImportExportView: React.FC<ImportExportViewProps> = ({ theme, userId }) => {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [newMediaItems, setNewMediaItems] = useState<NewMediaItem[]>([]);

  const currentUsername: string = (() => {
    try {
      const userObjStr = localStorage.getItem('user');
      if (userObjStr) {
        const parsed = JSON.parse(userObjStr) as UserProfile;
        if (parsed && typeof parsed.username === 'string') {
          return parsed.username;
        }
      }
    } catch {
      // Ignore parse error
    }
    return userId;
  })();

  // --- 1. USER DATA EXPORT ---
  const handleExport = async (): Promise<void> => {
    try {
      setLoading(true);
      const rawItems = await getAllSavedItems({ userId, themeId: theme.id });

      const myCleanItems = rawItems.filter(
        (item: GameResultItem) => item.type !== 'friend_profile'
      );

      const exportPackage: ExportPackage = {
        version: '1.0',
        themeId: theme.id,
        userId: userId,
        username: currentUsername,
        exportedAt: new Date().toISOString(),
        items: myCleanItems 
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportPackage, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `export_${currentUsername}_${theme.id}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setStatusMessage('Your data has been successfully exported!');
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(error.message);
      }
      setStatusMessage('An error occurred while exporting.');
    } finally {
      setLoading(false);
    }
  };

  // --- 2. USER DATA IMPORT ---
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const fileReader = new FileReader();
    const files = event.target.files;

    if (files && files[0]) {
      fileReader.readAsText(files[0], "UTF-8");
      fileReader.onload = async (e: ProgressEvent<FileReader>): Promise<void> => {
        try {
          setLoading(true);
          const resultString = e.target?.result;
          if (typeof resultString !== 'string') {
            throw new Error('File could not be read as text');
          }

          const importedData = JSON.parse(resultString) as ExportPackage;

          if (importedData.themeId && importedData.themeId !== theme.id) {
            setStatusMessage(`⚠️ Error: This file belongs to theme '${importedData.themeId}', but you are currently in '${theme.id}'.`);
            setLoading(false);
            return;
          }

          if (!importedData.items || !Array.isArray(importedData.items)) {
            setStatusMessage('⚠️ Invalid file: No items found.');
            setLoading(false);
            return;
          }

          const friendUserId = importedData.userId;
          const friendUsername = importedData.username;

          if (!friendUserId) {
            setStatusMessage("⚠️ Invalid file: Could not determine the friend's user ID.");
            setLoading(false);
            return;
          }

          const myExistingItems = await getAllSavedItems({ userId, themeId: theme.id });

          const profileExists = myExistingItems.some(
            (ex: GameResultItem) => ex.type === 'friend_profile' && ex.data?.friendUserId === friendUserId
          );

          if (!profileExists && friendUsername) {
            await createUserSavedItem({
              userId: userId, 
              themeId: theme.id,
              type: 'friend_profile',
              name: `Friend Profile: ${friendUsername}`,
              data: {
                friendUserId: friendUserId,
                username: friendUsername
              }
            });
          }

          const existingFriendItems = await getAllSavedItems({ userId: friendUserId, themeId: theme.id });

          let addedCount = 0;
          let skippedCount = 0;

          for (const item of importedData.items) {
            const itemCreatedAt = item.createdAt || (item.data?.creationDate as string);

            const alreadyExists = existingFriendItems.some((ex: GameResultItem) => {
              const exCreatedAt = ex.createdAt || (ex.data?.creationDate as string);
              return ex.name === item.name && exCreatedAt === itemCreatedAt;
            });

            if (!alreadyExists) {
              await createUserSavedItem({
                userId: friendUserId,
                themeId: theme.id,
                type: item.type || 'unknown',
                name: item.name || 'Imported Item',
                username: friendUsername,
                data: (item.data && typeof item.data === 'object') ? item.data : {}
              });
              addedCount++;
            } else {
              skippedCount++;
            }
          }

          setStatusMessage(`✅ Import successful! ${addedCount} new items from ${friendUsername || 'friend'} added. ${skippedCount} duplicates skipped.`);
          window.dispatchEvent(new Event('refresh-database'));

        } catch (err: unknown) {
          if (err instanceof Error) {
            console.error(err.message);
          }
          setStatusMessage('❌ Error processing the import file.');
        } finally {
          setLoading(false);
        }
      };
    }
  };

  // --- 3. ENTITY TABLE EXPORT ---
  const handleEntityExport = async (): Promise<void> => {
    try {
      setLoading(true);
      const res = await fetch('/api/themes');
      if (!res.ok) throw new Error('Failed to fetch themes');
      const themesData = await res.json();
      const currentThemeData = themesData.find((t: Theme & { entities?: EntityItem[] }) => t.id === theme.id);
      const entities = currentThemeData?.entities || [];

      const exportPackage: EntityExportPackage = {
        version: '1.0',
        themeId: theme.id,
        exportedAt: new Date().toISOString(),
        entities: entities
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportPackage, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `entities_export_${theme.id}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setStatusMessage('Entity table has been successfully exported!');
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(error.message);
      }
      setStatusMessage('An error occurred while exporting entities.');
    } finally {
      setLoading(false);
    }
  };

  // --- 4. ENTITY TABLE IMPORT (FLEXIBLE KEYS, ADDITIONS, REMOVALS & CAROUSEL) ---
  const handleEntityFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const fileReader = new FileReader();
    const files = event.target.files;

    if (files && files[0]) {
      fileReader.readAsText(files[0], "UTF-8");
      fileReader.onload = async (e: ProgressEvent<FileReader>): Promise<void> => {
        try {
          setLoading(true);
          setNewMediaItems([]);
          const resultString = e.target?.result;
          if (typeof resultString !== 'string') {
            throw new Error('File could not be read as text');
          }

          const importedData = JSON.parse(resultString) as EntityExportPackage;

          if (importedData.themeId && importedData.themeId !== theme.id) {
            setStatusMessage(`⚠️ Error: This entity file belongs to theme '${importedData.themeId}', but you are currently in '${theme.id}'.`);
            setLoading(false);
            return;
          }

          if (!importedData.entities || !Array.isArray(importedData.entities)) {
            setStatusMessage('⚠️ Invalid file: No entities found.');
            setLoading(false);
            return;
          }

          const res = await fetch('/api/themes');
          if (!res.ok) throw new Error('Failed to fetch existing entities');
          const themesData = await res.json();
          const currentThemeData = themesData.find((t: Theme & { entities?: EntityItem[] }) => t.id === theme.id);
          const existingEntities: EntityItem[] = currentThemeData?.entities || [];
          const existingMap = new Map(existingEntities.map(en => [en.id, en]));

          let addedCount = 0;
          let updatedCount = 0;
          let skippedCount = 0;
          const collectedNewMedia: NewMediaItem[] = [];

          for (const importedEntity of importedData.entities) {
            const existing = existingMap.get(importedEntity.id);
            const importedImages = importedEntity.image || {};

            if (!existing) {
              const createRes = await fetch(`/api/themes/${theme.id}/entities`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(importedEntity)
              });

              if (createRes.ok) {
                addedCount++;
                for (const [imgKey, imgVal] of Object.entries(importedImages)) {
                  if (typeof imgVal === 'string' && imgVal.trim() !== '') {
                    const urls = imgVal.split(/\s+/).filter(Boolean);
                    urls.forEach(url => {
                      collectedNewMedia.push({
                        url,
                        entityName: importedEntity.name || 'New Entity',
                        category: imgKey
                      });
                    });
                  }
                }
              } else {
                console.error(`Failed to create entity ${importedEntity.id}`);
              }
            } else {
              const existingImages = existing.image || {};
              let entityHasChanges = false;
              const updatedImages: EntityImages = { ...existingImages };

              const allImageKeys = new Set([...Object.keys(existingImages), ...Object.keys(importedImages)]);

              for (const imgKey of allImageKeys) {
                const existingVal = typeof existingImages[imgKey] === 'string' ? (existingImages[imgKey] as string) : '';
                const importedVal = typeof importedImages[imgKey] === 'string' ? (importedImages[imgKey] as string) : '';

                if (existingVal !== importedVal) {
                  entityHasChanges = true;

                  const existingUrls = new Set(existingVal.split(/\s+/).filter(Boolean));
                  const importedUrls = importedVal.split(/\s+/).filter(Boolean);

                  const brandNewUrls = importedUrls.filter(u => !existingUrls.has(u));
                  brandNewUrls.forEach(url => {
                    collectedNewMedia.push({
                      url,
                      entityName: importedEntity.name || existing.name || 'Entity',
                      category: imgKey
                    });
                  });

                  updatedImages[imgKey] = importedVal;
                }
              }

              if (
                existing.name !== importedEntity.name ||
                existing.type !== importedEntity.type ||
                JSON.stringify(existing.metadata) !== JSON.stringify(importedEntity.metadata)
              ) {
                entityHasChanges = true;
              }

              if (entityHasChanges) {
                const updateRes = await fetch(`/api/themes/${theme.id}/entities/${importedEntity.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    ...existing,
                    ...importedEntity,
                    image: updatedImages
                  })
                });

                if (updateRes.ok) {
                  updatedCount++;
                } else {
                  console.error(`Failed to update entity ${importedEntity.id}`);
                }
              } else {
                skippedCount++;
              }
            }
          }

          setNewMediaItems(collectedNewMedia);
          setStatusMessage(`✅ Entity import complete! Added: ${addedCount}, Updated (additions/removals): ${updatedCount}, Unchanged/Skipped: ${skippedCount}.`);
          window.dispatchEvent(new Event('refresh-database'));

        } catch (err: unknown) {
          if (err instanceof Error) {
            console.error(err.message);
          }
          setStatusMessage('❌ Error processing the entity import file.');
        } finally {
          setLoading(false);
        }
      };
    }
  };

  // --- 🧪 TEST HELPER ---
  const handleTestPreview = (): void => {
    setNewMediaItems([
      { url: 'https://i.imgur.com/7NMkHpe.jpeg', entityName: 'Lionel Messi', category: 'dribbel' },
      { url: 'https://i.imgur.com/gW2cwet.mp4', entityName: 'Lionel Messi', category: 'dribbel' },
      { url: 'https://i.imgur.com/PmEQAZk.png', entityName: 'Cristiano Ronaldo', category: 'penalties' },
      { url: 'https://i.imgur.com/9Gxs3Dj.jpeg', entityName: 'Kylian Mbappé', category: 'Face' },
    ]);
    setStatusMessage('🧪 Test preview geactiveerd! Je kunt nu de carrousel bekijken.');
  };

  const isVideoUrl = (url: string): boolean => {
    const lower = url.toLowerCase();
    return lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.ogg') || lower.includes('.mp4');
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2>Database Synchronization ({theme.title})</h2>
        <p className={styles.subtitle}>
          Manage your personal game data or synchronize theme entities and media tables.
        </p>

        {/* GROUP 1: Player & Game Data */}
        <div className={styles.groupCard}>
          <h3 className={styles.groupHeader}>🎮 Player & Game Data</h3>
          
          <div className={styles.section}>
            <h4>Export My Data</h4>
            <p>Generates a JSON file containing only your own saved items.</p>
            <button className={styles.primaryButton} onClick={handleExport} disabled={loading}>
              {loading ? 'Processing...' : 'Export My Data (.json)'}
            </button>
          </div>

          <div className={styles.section}>
            <h4>Import Friend Data</h4>
            <p>Upload a friend's export file. The data will be stored directly in your database.</p>
            <label className={`${styles.fileInputLabel} ${loading ? styles.disabled : ''}`}>
              {loading ? 'Importing...' : 'Choose Friend File...'}
              <input
                type="file"
                accept=".json"
                onChange={handleFileChange}
                disabled={loading}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>

        {/* GROUP 2: Theme Entities & Media Table */}
        <div className={styles.groupCard}>
          <h3 className={styles.groupHeader}>🖼️ Theme Entities & Media Table</h3>
          
          <div className={styles.section}>
            <h4>Export Entity Table</h4>
            <p>Generates a JSON file containing all entities and media configured for this theme.</p>
            <button className={styles.primaryButton} onClick={handleEntityExport} disabled={loading}>
              {loading ? 'Processing...' : 'Export Entity Table (.json)'}
            </button>
          </div>

          <div className={styles.section}>
            <h4>Import Entity Table</h4>
            <p>Upload an entity table file. Existing entities will be checked for media additions and removals, and updated automatically.</p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <label className={`${styles.fileInputLabel} ${loading ? styles.disabled : ''}`}>
                {loading ? 'Importing...' : 'Choose Entity File...'}
                <input
                  type="file"
                  accept=".json"
                  onChange={handleEntityFileChange}
                  disabled={loading}
                  style={{ display: 'none' }}
                />
              </label>
              <button 
                className={styles.primaryButton} 
                onClick={handleTestPreview} 
                style={{ backgroundColor: '#6c757d' }}
                title="Test de media carrousel zonder database wijziging"
              >
                🧪 Test Carrousel Preview
              </button>
            </div>
          </div>
        </div>

        {statusMessage && (
          <div className={styles.statusBox}>
            {statusMessage}
          </div>
        )}

        {/* New Media Carousel Preview */}
        {newMediaItems.length > 0 && (
          <div className={styles.groupCard}>
            <h3 className={styles.groupHeader}>✨ Newly Imported Media Preview ({newMediaItems.length})</h3>
            <p style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '10px' }}>
              The following images and videos were detected as new during the entity import:
            </p>
            <div className={styles.mediaCarouselContainer}>
              {newMediaItems.map((item, index) => (
                <div key={index} className={styles.mediaItemCard}>
                  {isVideoUrl(item.url) ? (
                    <video 
                      controls 
                      preload="metadata"
                      playsInline
                      className={styles.mediaItemContent}
                    >
                      <source src={item.url} type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                  ) : (
                    <img src={item.url} alt={item.entityName} className={styles.mediaItemContent} />
                  )}
                  <span className={styles.mediaEntityName} title={item.entityName}>
                    {item.entityName}
                  </span>
                  <span className={styles.mediaCategoryBadge}>
                    {item.category}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportExportView;