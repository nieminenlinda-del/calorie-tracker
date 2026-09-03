import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Tänään', end: true },
  { to: '/templates', label: 'Mallit', end: false },
  { to: '/settings', label: 'Tavoitteet', end: false },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Päänavigaatio">
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
