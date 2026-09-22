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

interface UserProfile {
  username?: string;
}

export const ImportExportView: React.FC<ImportExportViewProps> = ({ theme, userId }) => {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

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

  // --- 1. EXPORT: Only your own data (excluding friend meta) ---
  const handleExport = async (): Promise<void> => {
    try {
      setLoading(true);
      const rawItems = await getAllSavedItems({ userId, themeId: theme.id });
      
      const myCleanItems = rawItems.filter((item: GameResultItem) => item.type !== 'friend_profile');

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

  // --- 2. IMPORT: Save friend items & profile record ---
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

          // A. Fetch existing items for this theme to check for duplicates
          const existingItems = await getAllSavedItems({ themeId: theme.id });

          // B. Save the profile record under your userId
          const profileExists = existingItems.some(
            (ex: GameResultItem) => ex.userId === userId && ex.type === 'friend_profile' && ex.friendUserId === friendUserId
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

          let addedCount = 0;
          let skippedCount = 0;

          // C. Save the friend's regular game items to the database
          for (const item of importedData.items) {
            const itemCreatedAt = item.createdAt || (item.data?.creationDate as string);

            const alreadyExists = existingItems.some((ex: GameResultItem) => {
              const exCreatedAt = ex.createdAt || (ex.data?.creationDate as string);
              return ex.userId === friendUserId && exCreatedAt === itemCreatedAt;
            });

            if (!alreadyExists) {
              await createUserSavedItem({
                userId: friendUserId,
                themeId: theme.id,
                type: item.type || 'unknown',
                name: item.name || 'Imported Item',
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

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2>Database Synchronization ({theme.title})</h2>
        <p className={styles.subtitle}>
          Export your data or import a friend's file.
        </p>

        <div className={styles.section}>
          <h3>📤 Export My Data</h3>
          <p>Generates a JSON file containing only your own saved items.</p>
          <button className={styles.primaryButton} onClick={handleExport} disabled={loading}>
            {loading ? 'Processing...' : 'Export My Data (.json)'}
          </button>
        </div>

        <hr className={styles.divider} />

        <div className={styles.section}>
          <h3>📥 Import Friend Data</h3>
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

        {statusMessage && (
          <div className={styles.statusBox}>
            {statusMessage}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportExportView;