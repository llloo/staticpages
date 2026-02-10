import { NavLink, Outlet } from 'react-router-dom';
import './Layout.css';

const LearnIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const MoreIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="19" r="1" />
  </svg>
);

const navItems = [
  { to: '/', label: '学习', Icon: LearnIcon },
  { to: '/more', label: '更多', Icon: MoreIcon },
];

export default function Layout() {
  return (
    <div className="layout">
      <header className="header">
        <h1 className="header-title">词忆</h1>
      </header>

      <main className="main-content">
        <Outlet />
      </main>

      <nav className="tab-bar">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `tab-item ${isActive ? 'active' : ''}`
            }
          >
            <span className="tab-icon">
              <item.Icon />
            </span>
            <span className="tab-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
