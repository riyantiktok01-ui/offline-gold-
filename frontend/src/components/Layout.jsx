import { Bell, Search } from 'lucide-react';
import Sidebar from './Sidebar';

export default function Layout({ children, activeNav, onNavChange, title }) {
  return (
    <div className="app-layout">
      <Sidebar
        collapsed={false}
        onToggle={() => {}}
        activeNav={activeNav}
        onNavChange={onNavChange}
      />
      <main className="main-content">
        <header className="top-header">
          <div className="header-left">
            <h1 className="header-title">{title || 'Dashboard'}</h1>
          </div>
          <div className="header-right">
            <button className="header-btn">
              <Search size={18} />
            </button>
            <button className="header-btn">
              <Bell size={18} />
            </button>
            <div className="avatar">JD</div>
          </div>
        </header>
        <div className="content-wrapper">
          {children}
        </div>
      </main>
    </div>
  );
}