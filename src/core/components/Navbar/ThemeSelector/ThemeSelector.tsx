import styles from './ThemeSelector.module.css';
import type { Theme } from "../../../../types";

/**
 * Prop definitions for the ThemeSelector component.
 * It requires the list of loaded workspace configs, the active configuration ID,
 * and a callback execution mechanism to change themes globally inside the main router context.
 */
interface Props {
  loadedThemes: Theme[]; 
  currentThemeId: string;
  onThemeChange: (theme: Theme) => void;
}

/**
 * ThemeSelector renders a dropdown menu selection interface item.
 * It reads dynamic global layout options configurations directly from the database context
 * allowing standard end-users to swap active layout styling skins.
 */
export const ThemeSelector = ({ loadedThemes = [], currentThemeId, onThemeChange }: Props) => {
  return (
    <div className={styles.themeSelectorContainer}>
      {/* HTML Label bound explicitly to the dropdown menu via the 'htmlFor' property targeting the unique ID */}
      <label htmlFor="theme-select" className={styles.label}>
        Kies je onderwerp:
      </label>
      
      {/* The actual HTML selection dropdown element */}
      <select
        id="theme-select"
        className={styles.themeDropdown}
        value={currentThemeId}
        onChange={(e) => {
          // Scans the local array props to match the exact record configuration object being clicked
          const selected = loadedThemes?.find(t => t.id === e.target.value);
          // Fires the state mutation sequence only if a matching object is securely resolved
          if (selected) onThemeChange(selected);
        }}
      >
        {/* Iterates dynamically through each loaded theme option configurations available from database states */}
        {loadedThemes?.map(theme => (
          <option key={theme.id} value={theme.id} className={styles.option}>
            {theme.title}
          </option>
        ))}
      </select>
    </div>
  );
};