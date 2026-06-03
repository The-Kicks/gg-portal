import { useNavigate, useParams, useLocation } from 'react-router-dom';
import styles from './Navbar.module.css';
import { ThemeSelector } from './ThemeSelector/ThemeSelector';
import { LightDarkToggle } from './LightDarkToggle/LightDarkToggle';
import type { Theme } from '../../../types';

/**
 * Prop definitions for the Navbar component.
 * It takes the list of available themes, the active theme context configuration,
 * a callback to shift themes, and dark mode configuration controls.
 */
interface NavbarProps {
  loadedThemes: Theme[];
  activeTheme: Theme;
  onThemeChange: (theme: Theme) => void;
  isDark: boolean;
  toggleDark: () => void;
}

/**
 * Navbar component acts as the global primary site header.
 * It handles branding redirection, app navigation layout mappings based on active configurations, 
 * light/dark mode triggers, and theme switching.
 */
export const Navbar = ({ loadedThemes, activeTheme, onThemeChange, isDark, toggleDark }: NavbarProps) => {
  const navigate = useNavigate();
  // Retrieves the current active workspace URL context key (e.g., 'formula-1' or 'voetbal')
  const { themeName } = useParams<{ themeName: string }>();
  const location = useLocation();

  /**
   * Extracts the current active sub-route level directly out of the URL string.
   * Example path: '/formula-1/l1' -> splits by '/' -> array ends with 'l1' -> currentLayer = 'l1'
   * Falls back to 'home' if the split resolves to an empty string.
   */
  const currentLayer = location.pathname.split('/').pop() || 'home';

  /**
   * Safe Navigation Handler.
   * Delaying the router shift by 50 milliseconds using a setTimeout gives heavy background 
   * elements (like active HTML Iframes or large charts) a tiny window to unmount properly.
   * This results in smoother browser render transitions.
   */
  const handleNavClick = (layer: string) => {
    setTimeout(() => {
      navigate(`/${themeName}/${layer.toLowerCase()}`);
    }, 50);
  };

  return (
    <nav className={styles.navbar}>
      {/* LEFT SECTION: Branding Identity Logo & Theme Toggle Switch */}
      <div className={styles.navLeft}>
        <span className={styles.portalName} onClick={() => navigate(`/${themeName}/home`)}>
          GG-PORTAL
        </span>
        <LightDarkToggle isDark={isDark} onToggle={toggleDark} />
      </div>

      {/* CENTER SECTION: Dynamic Navigation Links based on active theme settings */}
      <div className={styles.navCenter}>
        {/* Hardcoded static Home navigation link */}
        <span
          className={`${styles.navItem} ${currentLayer === 'home' ? styles.active : ''}`}
          onClick={() => handleNavClick('home')}
        >
          HOME
        </span>

        {/* Maps over the configured layout navbar items saved within the database configuration */}
        {activeTheme.navbarItems?.map((item) => {
          // Resolves user-friendly display labels (e.g., maps system name 'l1' to custom display title 'Teams')
          const label = (activeTheme.labels as Record<string, string>)[item] || item;
          // Compares lowercased strings to accurately apply high-contrast active indicator styling
          const isItemActive = currentLayer === item.toLowerCase();

          return (
            <span
              key={item}
              className={`${styles.navItem} ${isItemActive ? styles.active : ''}`}
              onClick={() => handleNavClick(item)}
            >
              {label.toUpperCase()}
            </span>
          );
        })}
      </div>

      {/* RIGHT SECTION: Workspace selection dropdown configuration component */}
      <div className={styles.navRight}>
        <ThemeSelector
          loadedThemes={loadedThemes}
          currentThemeId={activeTheme.id}
          onThemeChange={onThemeChange}
        />
      </div>
    </nav>
  );
};