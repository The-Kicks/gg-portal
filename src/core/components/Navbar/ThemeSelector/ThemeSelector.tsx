import styles from './ThemeSelector.module.css';
import type { Theme } from "../../../../types";

interface Props {
  loadedThemes: Theme[]; 
  currentThemeId: string;
  onThemeChange: (theme: Theme) => void;
}

/**
 * Renders an accessible HTML dropdown menu item allowing users to switch 
 * between available database configurations and global dashboard application skin themes.
 */
export const ThemeSelector = ({ loadedThemes = [], currentThemeId, onThemeChange }: Props) => {
  return (
    <div className={styles.themeSelectorContainer}>
      <label htmlFor="theme-select" className={styles.label}>
        Kies je onderwerp:
      </label>
      
      <select
        id="theme-select"
        className={styles.themeDropdown}
        value={currentThemeId}
        onChange={(e) => {
          const selected = loadedThemes?.find(t => t.id === e.target.value);
          if (selected) onThemeChange(selected);
        }}
      >
        {loadedThemes?.map(theme => (
          <option key={theme.id} value={theme.id} className={styles.option}>
            {theme.title}
          </option>
        ))}
      </select>
    </div>
  );
};