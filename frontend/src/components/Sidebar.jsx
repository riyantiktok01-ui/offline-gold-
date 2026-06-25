import { useState, useEffect } from 'react';
import { LayoutDashboard, Search, Users, Settings, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { getProjects, createProject } from '../api';
import { useToast } from './Toast';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard', badge: null },
  { icon: Search, label: 'New Search', id: 'search', badge: null },
  { icon: Users, label: 'All Leads', id: 'leads', badge: null },
];

const PROJECT_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export default function Sidebar({ collapsed, onToggle, activeNav, onNavChange, onSelectProject, selectedProjectId }) {
  const [projects, setProjects] = useState([]);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const addToast = useToast();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const data = await getProjects();
      setProjects(Array.isArray(data) ? data : []);
    } catch (e) {
      // silently fail, projects list will be empty
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      const project = await createProject(newProjectName.trim());
      setProjects(prev => [...prev, project]);
      setNewProjectName('');
      setShowNewProject(false);
      addToast('Project Created', `"${project.name}" has been created`, 'success');
    } catch (err) {
      addToast('Error', err.message, 'error');
    }
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">OG</div>
        <span className="sidebar-logo-text">OfflineGold</span>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-title">Main</div>
        {navItems.map((item) => (
          <div
            key={item.id}
            className={`nav-item ${activeNav === item.id ? 'active' : ''}`}
            onClick={() => onNavChange(item.id)}
          >
            <span className="nav-item-icon">
              <item.icon size={18} />
            </span>
            <span className="nav-item-label">{item.label}</span>
            {item.badge && <span className="nav-item-badge">{item.badge}</span>}
          </div>
        ))}

        <div className="nav-section-title" style={{ marginTop: '16px' }}>Projects</div>
        
        <div className="projects-list">
          {projects.map((project, idx) => (
            <div
              key={project.id}
              className={`project-item ${selectedProjectId === project.id ? 'active' : ''}`}
              onClick={() => {
                onSelectProject(project);
                onNavChange('dashboard');
              }}
            >
              <div className="project-dot" style={{ background: PROJECT_COLORS[idx % PROJECT_COLORS.length] }} />
              <span className="project-name">{project.name}</span>
              <span className="project-count">{project.lead_count || 0}</span>
            </div>
          ))}
        </div>

        {showNewProject ? (
          <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <input
              className="form-input"
              placeholder="Project name..."
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              style={{ fontSize: '12px', padding: '6px 10px' }}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleCreateProject()}
            />
            <div style={{ display: 'flex', gap: '4px' }}>
              <button className="btn btn-primary btn-sm" onClick={handleCreateProject} style={{ flex: 1, fontSize: '11px', padding: '4px 8px' }}>Create</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowNewProject(false)} style={{ fontSize: '11px', padding: '4px 8px' }}>X</button>
            </div>
          </div>
        ) : (
          <button className="create-project-btn" onClick={() => setShowNewProject(true)}>
            <Plus size={16} />
            <span>New Project</span>
          </button>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="nav-item" style={{ marginBottom: '4px' }}>
          <span className="nav-item-icon">
            <Settings size={18} />
          </span>
          <span className="nav-item-label">Settings</span>
        </div>
        <button className="sidebar-toggle" onClick={onToggle}>
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
    </aside>
  );
}