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
      // Stilzwijgen bij parse fout
    }
    return userId;
  })();

  // --- 1. EXPORT: Alleen jouw eigen data (exclusief vriend-meta) ---
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

      setStatusMessage('Jouw data is succesvol geëxporteerd!');
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(error.message);
      }
      setStatusMessage('Fout opgetreden bij het exporteren.');
    } finally {
      setLoading(false);
    }
  };

  // --- 2. IMPORT: Sla vriend-items én het profiel-record op ---
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
            throw new Error('Bestand kon niet als tekst gelezen worden');
          }

          const importedData = JSON.parse(resultString) as ExportPackage;

          if (importedData.themeId && importedData.themeId !== theme.id) {
            setStatusMessage(`⚠️ Fout: Dit bestand hoort bij thema '${importedData.themeId}', maar je bent nu in '${theme.id}'.`);
            setLoading(false);
            return;
          }

          if (!importedData.items || !Array.isArray(importedData.items)) {
            setStatusMessage('⚠️ Ongeldig bestand: Geen items gevonden.');
            setLoading(false);
            return;
          }

          const friendUserId = importedData.userId;
          const friendUsername = importedData.username;

          if (!friendUserId) {
            setStatusMessage('⚠️ Ongeldig bestand: Kan de gebruiker van de vriend niet achterhalen.');
            setLoading(false);
            return;
          }

          // A. Haal alle items voor dit thema op om te controleren op duplicaten
          const existingItems = await getAllSavedItems({ themeId: theme.id });

          // B. Sla het profiel-record op onder jouw userId
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

          // C. Sla de reguliere game-items van de vriend op in de database
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

          setStatusMessage(`✅ Import gelukt! ${addedCount} nieuwe items van ${friendUsername || 'vriend'} toegevoegd. ${skippedCount} duplicaten overgeslagen.`);
          
          window.dispatchEvent(new Event('refresh-database'));

        } catch (err: unknown) {
          if (err instanceof Error) {
            console.error(err.message);
          }
          setStatusMessage('❌ Fout bij het verwerken van het importbestand.');
        } finally {
          setLoading(false);
        }
      };
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2>Database Synchronisatie ({theme.title})</h2>
        <p className={styles.subtitle}>
          Exporteer jouw gegevens of importeer het bestand van een vriend.
        </p>

        <div className={styles.section}>
          <h3>📤 Exporteer mijn gegevens</h3>
          <p>Maakt een JSON-bestand met uitsluitend jouw eigen opgeslagen items.</p>
          <button className={styles.primaryButton} onClick={handleExport} disabled={loading}>
            {loading ? 'Bezig...' : 'Exporteer Mijn Data (.json)'}
          </button>
        </div>

        <hr className={styles.divider} />

        <div className={styles.section}>
          <h3>📥 Importeer vriend gegevens</h3>
          <p>Upload het exportbestand van een vriend. De data wordt direct opgeslagen in je database.</p>
          
          <label className={`${styles.fileInputLabel} ${loading ? styles.disabled : ''}`}>
            {loading ? 'Bezig met importeren...' : 'Kies Vriend Bestand...'}
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