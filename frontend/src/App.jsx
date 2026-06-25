import { useState } from 'react';
import { Menu } from 'lucide-react';
import { ToastProvider } from './components/Toast';
import { ThemeProvider, ThemeToggle } from './components/ThemeContext';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import SearchPage from './components/SearchPage';

export default function App() {
  const [activeNav, setActiveNav] = useState('dashboard');
  const [currentProject, setCurrentProject] = useState(null);
  const [searchResults, setSearchResults] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const titles = {
    dashboard: currentProject ? currentProject.name : 'Dashboard',
    search: 'New Search',
    leads: 'All Leads',
  };

  const handleSearchComplete = (leads, projectId) => {
    setSearchResults(leads);
    if (projectId) {
      setCurrentProject({ id: projectId });
    }
    setActiveNav('dashboard');
  };

  const handleSelectProject = (project) => {
    setCurrentProject(project);
    setSearchResults(null);
    setSidebarOpen(false);
  };

  const handleNavChange = (nav) => {
    setActiveNav(nav);
    setSidebarOpen(false);
  };

  const renderContent = () => {
    switch (activeNav) {
      case 'dashboard':
        return (
          <Dashboard
            projectId={currentProject?.id}
            searchResults={searchResults}
          />
        );
      case 'search':
        return <SearchPage onSearchComplete={handleSearchComplete} />;
      case 'leads':
        return (
          <Dashboard
            projectId={currentProject?.id}
            searchResults={searchResults}
          />
        );
      default:
        return (
          <Dashboard
            projectId={currentProject?.id}
            searchResults={searchResults}
          />
        );
    }
  };

  return (
    <ThemeProvider>
      <ToastProvider>
        <div className="app-layout">
          {/* Mobile sidebar overlay */}
          <div
            className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`}
            onClick={() => setSidebarOpen(false)}
          />

          <Sidebar
            collapsed={false}
            onToggle={() => {}}
            activeNav={activeNav}
            onNavChange={handleNavChange}
            onSelectProject={handleSelectProject}
            selectedProjectId={currentProject?.id}
            sidebarOpen={sidebarOpen}
          />
          <main className="main-content">
            <header className="top-header">
              <div className="header-left">
                <button className="hamburger-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
                  <Menu size={20} />
                </button>
                <h1 className="header-title">{titles[activeNav] || 'Dashboard'}</h1>
              </div>
              <div className="header-right">
                <ThemeToggle />
                <div className="avatar">OG</div>
              </div>
            </header>
            <div className="content-wrapper">
              {renderContent()}
            </div>
          </main>
        </div>
      </ToastProvider>
    </ThemeProvider>
  );
}