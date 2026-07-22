import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
import { fetchThemes } from './core/api';
import { Navbar } from "./core/components/Navbar/Navbar";
import { ScrollToTop } from './core/helpers/scrollToTop';
import Home from "./views/Home/Home";
import { GuessWhoViewPage } from './views/Games/GuessWho/GuessWhoViewPage';
import { BlindRankingViewPage } from './views/Games/BlindRanking/BlindRankingViewPage';
import { SorterViewPage }  from './views/Games/Sorter/SorterViewPage'
import { L1View, L2View, L3View, L4View } from "./views/Layers/index";
import { ExtendedProfileViewPage } from './views/ExtendedProfileView/ExtendedProfileViewPage';
import { ExtendedStructureViewPage } from './views/ExtendedStructureView/ExtendedStructureViewPage';
import { AdminDashboard, AdminEditPage, AdminEntityCreate, AdminThemeManager } from './views/Admin';
import type { Theme } from './types';

interface AppContentProps {
  loadedThemes: Theme[];
  refreshThemes: () => Promise<void>;
}

/**
 * Handles the primary layout view injection, dynamic dark mode toggle styles, 
 * and controls routing mappings within an active theme workspace context.
 */
function AppContent({ loadedThemes, refreshThemes }: AppContentProps) {
  const navigate = useNavigate();
  const { themeName } = useParams<{ themeName: string }>();
  const activeTheme = loadedThemes.find(t => t.id === themeName) || loadedThemes[0];
  const [isDark, setIsDark] = useState<boolean>(true);

  useEffect(() => {
    if (!activeTheme) return;

    const root = document.documentElement;
    const colors: Record<string, string> = {
      '--primary': (isDark ? activeTheme.darkPrimaryColor : activeTheme.primaryColor) || '',
      '--secondary': (isDark ? activeTheme.darkSecondaryColor : activeTheme.secondaryColor) || '',
      '--bg': (isDark ? activeTheme.darkBackgroundColor : activeTheme.backgroundColor) || '',
      '--text': (isDark ? activeTheme.darkTextColor : activeTheme.textColor) || '',
      '--navbarColor': (isDark ? activeTheme.darkNavbarColor : activeTheme.navbarColor) || '',
    };

    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    if (colors['--bg']) {
      document.body.style.backgroundColor = colors['--bg'];
    }
  }, [isDark, activeTheme]);

  useEffect(() => {
    const handleRefresh = () => {
      refreshThemes();
    };

    window.addEventListener('refresh-database', handleRefresh);
    return () => window.removeEventListener('refresh-database', handleRefresh);
  }, [refreshThemes]);

  /**
   * Updates the application routing context to transition to a newly selected workspace configuration.
   */
  const handleThemeChange = (newTheme: Theme) => {
    navigate(`/${newTheme.id}/home`);
  };

  if (!activeTheme) return null;

  /**
   * Determines if a specific hierarchy layer has been declared and configured in the theme labels database setup.
   */
  const hasLayer = (layer: string): boolean => {
    return !!activeTheme.labels[layer];
  };

  return (
    <div className="app-container">
      <ScrollToTop />
      <Navbar
        loadedThemes={loadedThemes}
        activeTheme={activeTheme}
        onThemeChange={handleThemeChange}
        isDark={isDark}
        toggleDark={() => setIsDark(!isDark)}
      />

      <Routes>
        <Route path="/" element={<Navigate to="home" replace />} />
        <Route path="home" element={<Home theme={activeTheme} isDark={isDark} />} />
        <Route path="guesswho" element={<GuessWhoViewPage theme={activeTheme} />} />
        <Route path="blindranking" element={<BlindRankingViewPage theme={activeTheme}/>} />
        <Route path="sorter" element={<SorterViewPage theme={activeTheme}/>} />

        <Route path="l1" element={hasLayer('l1') ? <L1View theme={activeTheme} /> : <Navigate to="../home" replace />} />
        <Route path="l2" element={hasLayer('l2') ? <L2View theme={activeTheme} /> : <Navigate to="../l3" replace />} />
        <Route path="l3" element={hasLayer('l3') ? <L3View theme={activeTheme} /> : <Navigate to="../home" replace />} />
        <Route path="l4" element={hasLayer('l4') ? <L4View theme={activeTheme} /> : <Navigate to="../home" replace />} />

        <Route path="profile/:id" element={<ExtendedProfileViewPage theme={activeTheme} />} />
        <Route path="structure/:id" element={<ExtendedStructureViewPage theme={activeTheme} />} />

        <Route path="admin" element={<AdminDashboard theme={activeTheme} />} />
        <Route path="admin/theme" element={
          <AdminThemeManager
            loadedThemes={loadedThemes}
            onRefresh={refreshThemes}
          />
        } />
        <Route path="admin/create" element={
          <AdminEntityCreate
            theme={activeTheme}
            onSave={() => navigate(`/${themeName}/admin`)}
            onCancel={() => navigate(`/${themeName}/admin`)}
          />
        } />
        <Route path="admin/edit/:id" element={<AdminEditPage theme={activeTheme} />} />
      </Routes>
    </div>
  );
}

/**
 * Root component of the application responsible for pulling core layout themes from backend 
 * APIs and setting up global browser-level routing boundaries.
 */
export default function App() {
  const [loadedThemes, setLoadedThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  /**
   * Executes an asynchronous network data fetch against backend resources to refresh theme settings.
   */
  const refreshThemes = async (): Promise<void> => {
    try {
      const data = await fetchThemes();
      setLoadedThemes(data);
    } catch (error) {
      console.error("Fout bij het verversen van de thema-data:", error);
    }
  };

  useEffect(() => {
    async function loadDatabaseData() {
      await refreshThemes();
      setLoading(false);
    }
    loadDatabaseData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
        <h3>Loading database graph structure, please wait...</h3>
      </div>
    );
  }

  if (loadedThemes.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif', color: 'red' }}>
        <h3>Cant establish connection with database. 🛑</h3>
        <p>Please check if database is online and backend is running</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={`/${loadedThemes[0].id}/home`} replace />} />
        <Route path="/:themeName/*" element={<AppContent loadedThemes={loadedThemes} refreshThemes={refreshThemes} />} />
        <Route path="*" element={<Navigate to={`/${loadedThemes[0].id}/home`} replace />} />
      </Routes>
    </BrowserRouter>
  );
}