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

export const Navbar = ({ loadedThemes, activeTheme, onThemeChange, isDark, toggleDark }: NavbarProps) => {
  const navigate = useNavigate();
  const { themeName } = useParams<{ themeName: string }>();
  const location = useLocation();

  const currentLayer = location.pathname.split('/').pop() || 'home';

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
        <button
          type="button"
          className={`${styles.navIconBtn} ${currentLayer === 'compare' ? styles.active : ''}`}
          onClick={() => handleNavClick('compare')}
          title="Vergelijk Sorters"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M7 18V6M3 10l4-4 4 4" />
            <path d="M17 6v12m-4-4l4 4 4-4" />
          </svg>
        </button>

        <button
          type="button"
          className={`${styles.navIconBtn} ${currentLayer === 'sync' ? styles.active : ''}`}
          onClick={() => handleNavClick('sync')}
          title="Delen / Synchroniseren"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </button>

        <ThemeSelector
          loadedThemes={loadedThemes}
          currentThemeId={activeTheme.id}
          onThemeChange={onThemeChange}
        />
      </div>
    </nav>
  );
};