import { useState } from 'react';
import { ToastProvider } from './components/Toast';
import Layout from './components/Layout';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import SearchPage from './components/SearchPage';

export default function App() {
  const [activeNav, setActiveNav] = useState('dashboard');
  const [currentProject, setCurrentProject] = useState(null);
  const [searchResults, setSearchResults] = useState(null);

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
  };

  const handleNavChange = (nav) => {
    setActiveNav(nav);
    if (nav !== 'dashboard') {
      // Don't clear search results when navigating away from dashboard
    }
    if (nav === 'search') {
      // Clear current project context when going to search
    }
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
    <ToastProvider>
      <div className="app-layout">
        <Sidebar
          collapsed={false}
          onToggle={() => {}}
          activeNav={activeNav}
          onNavChange={handleNavChange}
          onSelectProject={handleSelectProject}
          selectedProjectId={currentProject?.id}
        />
        <main className="main-content">
          <header className="top-header">
            <div className="header-left">
              <h1 className="header-title">{titles[activeNav] || 'Dashboard'}</h1>
            </div>
            <div className="header-right">
              <div className="avatar">OG</div>
            </div>
          </header>
          <div className="content-wrapper">
            {renderContent()}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}