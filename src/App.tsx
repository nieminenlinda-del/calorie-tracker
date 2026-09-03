import { BrowserRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { AddFoodPage } from './pages/AddFoodPage';
import { SettingsPage } from './pages/SettingsPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { TodayPage } from './pages/TodayPage';
import { ToastProvider } from './state/ToastContext';
import { TrackerProvider } from './state/TrackerContext';

export default function App() {
  return (
    <BrowserRouter>
      <TrackerProvider>
        <ToastProvider>
          <div className="app-shell">
            <Routes>
              <Route element={<Shell />}>
                <Route path="/" element={<TodayPage />} />
                <Route path="/add" element={<AddFoodPage />} />
                <Route path="/templates" element={<TemplatesPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Routes>
          </div>
        </ToastProvider>
      </TrackerProvider>
    </BrowserRouter>
  );
}

function Shell() {
  const location = useLocation();
  const hideNav = location.pathname.startsWith('/add');
  return (
    <>
      <Outlet />
      {hideNav ? null : <BottomNav />}
    </>
  );
}
