import { BrowserRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { LanguageProvider } from './i18n';
import { AddFoodPage } from './pages/AddFoodPage';
import { SettingsPage } from './pages/SettingsPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { TodayPage } from './pages/TodayPage';
import { ToastProvider } from './state/ToastContext';
import { TrackerProvider } from './state/TrackerContext';

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <TrackerProvider>
          <div className="app-shell">
            <ToastProvider>
              <Routes>
                <Route element={<Shell />}>
                  <Route path="/" element={<TodayPage />} />
                  <Route path="/add" element={<AddFoodPage />} />
                  <Route path="/templates" element={<TemplatesPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
              </Routes>
            </ToastProvider>
          </div>
        </TrackerProvider>
      </BrowserRouter>
    </LanguageProvider>
  );
}

function Shell() {
  const location = useLocation();
  const hideNav = location.pathname.startsWith('/add');
  return (
    <>
      <div className="app-scroll">
        <Outlet />
      </div>
      {hideNav ? null : <BottomNav />}
      <div id="overlay-root" />
    </>
  );
}
