import { NavLink } from 'react-router-dom';
import { useLanguage } from '../i18n';

export function BottomNav() {
  const { t } = useLanguage();
  const links = [
    { to: '/', label: t('nav.today'), end: true },
    { to: '/templates', label: t('nav.templates'), end: false },
    { to: '/settings', label: t('nav.targets'), end: false },
  ];

  return (
    <nav className="bottom-nav" aria-label={t('nav.main')}>
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
