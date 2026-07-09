import { useNavigate, useParams, useLocation } from 'react-router-dom';
import styles from './Navbar.module.css';
import { ThemeSelector } from './ThemeSelector/ThemeSelector';
import { LightDarkToggle } from './LightDarkToggle/LightDarkToggle';
import type { Theme } from '../../../types';

interface NavbarProps {
  loadedThemes: Theme[];
  activeTheme: Theme;
  onThemeChange: (theme: Theme) => void;
  isDark: boolean;
  toggleDark: () => void;
}

/**
 * Global navigation header component that renders branding links, theme toggles,
 * dynamic navigational steps based on layout configuration settings, and the workspace theme switcher.
 */
export const Navbar = ({ loadedThemes, activeTheme, onThemeChange, isDark, toggleDark }: NavbarProps) => {
  const navigate = useNavigate();
  const { themeName } = useParams<{ themeName: string }>();
  const location = useLocation();

  const currentLayer = location.pathname.split('/').pop() || 'home';

  /**
   * Postpones routing execution slightly using a brief timeout delay to allow active 
   * heavy sub-elements, charts, or frames enough window space to clear and unmount smoothly.
   */
  const handleNavClick = (layer: string) => {
    setTimeout(() => {
      navigate(`/${themeName}/${layer.toLowerCase()}`);
    }, 50);
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.navLeft}>
        <span className={styles.portalName} onClick={() => navigate(`/${themeName}/home`)}>
          GG-PORTAL
        </span>
        <LightDarkToggle isDark={isDark} onToggle={toggleDark} />
      </div>

      <div className={styles.navCenter}>
        <span
          className={`${styles.navItem} ${currentLayer === 'home' ? styles.active : ''}`}
          onClick={() => handleNavClick('home')}
        >
          HOME
        </span>

        {activeTheme.navbarItems?.map((item) => {
          const label = (activeTheme.labels as Record<string, string>)[item] || item;
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