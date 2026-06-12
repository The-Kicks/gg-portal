import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AdminEntityEdit } from './AdminEntityEdit';
import { entityService } from './EntityService';
import type { Theme } from '../../types';
import styles from './AdminGlobal.module.css';

interface Props { 
  theme: Theme; 
}

export const AdminEditPage: React.FC<Props> = ({ theme }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) {
    return (
      <div className={styles.container}>
        No valid entity or squad member ID provided.
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <button
        onClick={() => navigate(-1)}
        className={`${styles.btn} ${styles.btnBack}`}
      >
        Back to Dashboard
      </button>

      <AdminEntityEdit
        theme={theme}
        entityId={id}
        /**
         * Handles the persistence of updated entity details (e.g., driver, team, or player stats).
         * Dispatches a global event to trigger data re-fetching across the application upon success.
         * @param updated - The modified entity data payload.
         */
        onSave={async (updated) => {
          try {
            await entityService.update(theme.id, id, updated);

            // Notify the application layout to refresh the active records
            window.dispatchEvent(new Event('refresh-database'));

            navigate(-1);
          } catch (error) {
            console.error("Failed to update the specified entity:", error);
            alert("Could not save the modifications to the database.");
          }
        }}
        onCancel={() => navigate(-1)}
      />
    </div>
  );
};