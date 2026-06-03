import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
// Core layout components and API helpers
import { fetchThemes } from './core/api';
import { Navbar } from "./core/components/Navbar/Navbar";
import { ScrollToTop } from './core/helpers/scrollToTop';
import Home from "./views/Home/Home";

// Layer views representing different hierarchy levels (L1 down to L4)
import { L1View, L2View, L3View, L4View } from "./views/Layers/index";

// Detailed profile management and visualization views
import { ExtendedProfileViewPage } from './views/ExtendedProfileView/ExtendedProfileViewPage';
import { ExtendedStructureViewPage } from './views/ExtendedStructureView/ExtendedStructureViewPage';

// Admin management panel views
import { AdminDashboard, AdminEditPage, AdminEntityCreate, AdminThemeManager } from './views/Admin';
// Type definitions
import type { Theme } from './types';

/**
 * Prop definitions for the AppContent component.
 * It expects the array of themes currently loaded from the database
 * along with a trigger function to reload them when required.
 */
interface AppContentProps {
  loadedThemes: Theme[];
  refreshThemes: () => Promise<void>;
}

/**
 * AppContent handles the primary visual layout, theme variables injection,
 * and handles the core functional routing inside an active workspace theme context.
 */
function AppContent({ loadedThemes, refreshThemes }: AppContentProps) {
  const navigate = useNavigate();
  // Extracts the current working theme ID from the URL parameter directly (e.g. /formula-1/home -> themeName = "formula-1")
  const { themeName } = useParams<{ themeName: string }>();

  // Matches the URL theme name with database configurations. Falls back to the first available theme.
  const activeTheme = loadedThemes.find(t => t.id === themeName) || loadedThemes[0];
  
  // Track whether dark mode styling is enabled (defaults to dark mode)
  const [isDark, setIsDark] = useState<boolean>(true);

  /**
   * Effect Hook: Theme Variable Injection
   * Watches for changes in dark mode toggle or theme configurations, then translates
   * those options directly into global CSS variables on the root document level (:root).
   */
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

    // Loops over the translated configurations and updates the DOM styles dynamically
    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Directly sets background color on the document body to prevent visual flashes or unstyled white spaces
    if (colors['--bg']) {
      document.body.style.backgroundColor = colors['--bg'];
    }
  }, [isDark, activeTheme]);

  /**
   * Effect Hook: Database Event Listener
   * Binds a listener to the window object. If any child component sends a global 
   * 'refresh-database' trigger event, this listener catches it and fires a fresh API data refresh.
   */
  useEffect(() => {
    const handleRefresh = () => {
      refreshThemes();
    };

    window.addEventListener('refresh-database', handleRefresh);
    // Cleanup function: detaches the listener automatically when the component unmounts to prevent memory leaks
    return () => window.removeEventListener('refresh-database', handleRefresh);
  }, [refreshThemes]);

  /**
   * Safely switches the active application context to another chosen workspace configuration theme
   */
  const handleThemeChange = (newTheme: Theme) => {
    navigate(`/${newTheme.id}/home`);
  };

  // Guard Clause: Stops downstream execution if no theme metadata can be resolved
  if (!activeTheme) return null;

  /**
   * Checks if a specific relational hierarchy layer is active and configured
   * under the current theme settings. Returns true if a text label exists for it.
   */
  const hasLayer = (layer: string): boolean => {
    return !!activeTheme.labels[layer];
  };

  return (
    <div className="app-container">
      {/* Forces browser scroll positions back to top coordinates whenever navigating to a new route */}
      <ScrollToTop />
      
      {/* Main navigation control menu header component */}
      <Navbar
        loadedThemes={loadedThemes}
        activeTheme={activeTheme}
        onThemeChange={handleThemeChange}
        isDark={isDark}
        toggleDark={() => setIsDark(!isDark)}
      />

      {/* Primary URL Router Mapping Configuration for the Workspace Application */}
      <Routes>
        {/* Base route redirection inside a theme: redirects /:themeName to /:themeName/home */}
        <Route path="/" element={<Navigate to="home" replace />} />
        <Route path="home" element={<Home theme={activeTheme} isDark={isDark} />} />

        {/* Dynamic Layer Route Guards: Checks if a layer exists. If not, safely redirects somewhere else */}
        <Route path="l1" element={hasLayer('l1') ? <L1View theme={activeTheme} /> : <Navigate to="../home" replace />} />
        <Route path="l2" element={hasLayer('l2') ? <L2View theme={activeTheme} /> : <Navigate to="../l3" replace />} />
        <Route path="l3" element={hasLayer('l3') ? <L3View theme={activeTheme} /> : <Navigate to="../home" replace />} />
        <Route path="l4" element={hasLayer('l4') ? <L4View theme={activeTheme} /> : <Navigate to="../home" replace />} />

        {/* Informational item detail pages based on unique database entry keys */}
        <Route path="profile/:id" element={<ExtendedProfileViewPage theme={activeTheme} />} />
        <Route path="structure/:id" element={<ExtendedStructureViewPage theme={activeTheme} />} />

        {/* Administrative Dashboard Panel Routes */}
        <Route path="admin" element={<AdminDashboard theme={activeTheme} />} />

        {/* Administrative theme layout and color settings views */}
        <Route path="admin/theme" element={
          <AdminThemeManager
            loadedThemes={loadedThemes}
            onRefresh={refreshThemes}
          />
        } />

        {/* Administrative configuration portal for adding completely new items to the graphs */}
        <Route path="admin/create" element={
          <AdminEntityCreate
            theme={activeTheme}
            onSave={() => navigate(`/${themeName}/admin`)}
            onCancel={() => navigate(`/${themeName}/admin`)}
          />
        } />

        {/* Administrative edit portal view mapped to unique entry database keys */}
        <Route path="admin/edit/:id" element={<AdminEditPage theme={activeTheme} />} />
      </Routes>
    </div>
  );
}

/**
 * Root Entry Application Component.
 * Primarily handles loading global database configurations from the backend server
 * and setups the primary outer browser routing environment context.
 */
export default function App() {
  const [loadedThemes, setLoadedThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  /**
   * Performs an asynchronous API fetch action to grab theme layouts from the server
   */
  const refreshThemes = async (): Promise<void> => {
    try {
      const data = await fetchThemes();
      setLoadedThemes(data);
    } catch (error) {
      console.error("Fout bij het verversen van de thema-data:", error);
    }
  };

  /**
   * React Initialization hook: Automatically fires a data-load process exactly
   * once immediately when the application is opened or booted up by the client browser.
   */
  useEffect(() => {
    async function loadDatabaseData() {
      await refreshThemes();
      setLoading(false); // Disable structural loading screening view once data arrives
    }
    loadDatabaseData();
  }, []);

  // UI Screening View: Displayed only while waiting for initial data payloads from backend APIs
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
        <h3>Loading database graph structure, please wait...</h3>
      </div>
    );
  }

  // UI Screening View: Displayed if the server returns empty sets or fails connectivity expectations completely
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
        {/* Absolute root layout routing configuration rules. Redirects clean browser connections to theme zero */}
        <Route path="/" element={<Navigate to={`/${loadedThemes[0].id}/home`} replace />} />
        
        {/* Dynamic catch-all route mapping that delivers the request directly into the theme sub-views controller context */}
        <Route path="/:themeName/*" element={<AppContent loadedThemes={loadedThemes} refreshThemes={refreshThemes} />} />
        
        {/* Safety catch-all fallback pattern route redirect rule */}
        <Route path="*" element={<Navigate to={`/${loadedThemes[0].id}/home`} replace />} />
      </Routes>
    </BrowserRouter>
  );
}