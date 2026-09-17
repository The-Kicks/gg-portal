import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
import { fetchThemes } from './core/api';
import { Navbar } from "./core/components/Navbar/Navbar";
import { ScrollToTop } from './core/helpers/scrollToTop';
import Home from "./views/Home/Home";
import { GuessWhoViewPage } from './views/Games/GuessWho/GuessWhoViewPage';
import { BlindRankingViewPage } from './views/Games/BlindRanking/BlindRankingViewPage';
import { SorterViewPage } from './views/Games/Sorter/SorterViewPage';
import { L1View, L2View, L3View, L4View } from "./views/Layers/index";
import { ExtendedProfileViewPage } from './views/ExtendedProfileView/ExtendedProfileViewPage';
import { ExtendedStructureViewPage } from './views/ExtendedStructureView/ExtendedStructureViewPage';
import { AdminDashboard, AdminEditPage, AdminEntityCreate, AdminThemeManager } from './views/Admin';
import { Login } from './core/components/Login'
import { Register } from './core/components/Register';
import type { Theme } from './types';

interface AppContentProps {
  loadedThemes: Theme[];
  refreshThemes: () => Promise<void>;
  onLogout: () => void;
  userId: string;
}

function AppContent({ loadedThemes, refreshThemes, onLogout, userId }: AppContentProps) {
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

  const handleThemeChange = (newTheme: Theme) => {
    navigate(`/${newTheme.id}/home`);
  };

  if (!activeTheme) return null;

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

      {/* Uitlogknop in de hoek */}
      <div style={{ position: 'fixed', bottom: '1rem', right: '1rem', zIndex: 1000 }}>
        <button
          onClick={onLogout}
          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm shadow transition font-semibold"
        >
          Uitloggen
        </button>
      </div>

      <Routes>
        <Route path="/" element={<Navigate to="home" replace />} />
        <Route path="home" element={<Home theme={activeTheme} isDark={isDark} />} />
        {/* We geven de userId mee aan de GuessWho pagina zodat deze gelogd kan worden */}
        <Route path="guesswho" element={<GuessWhoViewPage theme={activeTheme} userId={userId} />} />
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

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [userId, setUserId] = useState<string>(localStorage.getItem('userId') || '');
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [loadedThemes, setLoadedThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshThemes = useCallback(async (): Promise<void> => {
    try {
      const data = await fetchThemes();
      setLoadedThemes(data);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Fout bij het verversen van de thema-data:", error.message);
      } else {
        console.error("Onbekende fout bij het verversen van de thema-data");
      }
    }
  }, []);

  useEffect(() => {
    async function loadDatabaseData() {
      if (token) {
        await refreshThemes();
      }
      setLoading(false);
    }
    loadDatabaseData();
  }, [token, refreshThemes]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('user');
    setToken(null);
    setUserId('');
  };

  const handleLoginSuccess = (newToken: string, newUserId?: string) => {
    localStorage.setItem('token', newToken);
    if (newUserId) {
      localStorage.setItem('userId', newUserId);
      setUserId(newUserId);
    }
    setToken(newToken);
  };

  if (!token) {
    return authView === 'login' ? (
      <Login
        onLoginSuccess={(newToken, userObj) => handleLoginSuccess(newToken, userObj?.id)}
        switchToRegister={() => setAuthView('register')}
      />
    ) : (
      <Register
        onRegisterSuccess={() => setAuthView('login')}
        switchToLogin={() => setAuthView('login')}
      />
    );
  }

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
        <button 
          onClick={handleLogout}
          style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Terug naar inloggen
        </button>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={`/${loadedThemes[0].id}/home`} replace />} />
        <Route 
          path="/:themeName/*" 
          element={
            <AppContent 
              loadedThemes={loadedThemes} 
              refreshThemes={refreshThemes} 
              onLogout={handleLogout}
              userId={userId}
            />
          } 
        />
        <Route path="*" element={<Navigate to={`/${loadedThemes[0].id}/home`} replace />} />
      </Routes>
    </BrowserRouter>
  );
}