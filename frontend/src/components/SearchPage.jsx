import { useState, useEffect } from 'react';
import { Search, MapPin, SlidersHorizontal, Target, List, Layers } from 'lucide-react';
import { searchLeads, getProjects, createProject } from '../api';
import { useToast } from './Toast';

const LOCATIONS = [
  'Austin, TX', 'Dallas, TX', 'Houston, TX', 'San Antonio, TX',
  'Phoenix, AZ', 'Los Angeles, CA', 'San Diego, CA', 'San Francisco, CA',
  'Denver, CO', 'Miami, FL', 'Atlanta, GA', 'Chicago, IL',
  'Seattle, WA', 'Portland, OR', 'Nashville, TN',
];

const NICHE_EXAMPLES = [
  'Pool Services', 'Roofing', 'Plumbers', 'Landscaping',
  'Electricians', 'HVAC', 'Cleaning', 'Painters',
  'Tree Service', 'Paving', 'Window Cleaning', 'General Contractors',
];

export default function SearchPage({ onSearchComplete }) {
  const [mode, setMode] = useState('single'); // 'single' | 'bulk'
  const [niche, setNiche] = useState('');
  const [location, setLocation] = useState('');
  const [bulkQueries, setBulkQueries] = useState('');
  const [limit, setLimit] = useState(50);
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState([]);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [searching, setSearching] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [statusMessage, setStatusMessage] = useState('');
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [bulkResults, setBulkResults] = useState([]);
  const addToast = useToast();

  useEffect(() => {
    getProjects().then(setProjects).catch(() => {});
  }, []);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      const project = await createProject(newProjectName.trim());
      setProjects(prev => [...prev, project]);
      setProjectId(String(project.id));
      setNewProjectName('');
      setShowNewProject(false);
      addToast('Project Created', `"${project.name}" has been created`, 'success');
    } catch (err) {
      addToast('Error', err.message, 'error');
    }
  };

  // Simulated progress for visual feedback
  useEffect(() => {
    if (!searching) {
      setProgress({ current: 0, total: 0 });
      return;
    }
    const messages = [
      'Scanning Google Maps...',
      'Finding offline businesses...',
      'Analyzing business profiles...',
      'Scoring closing likelihood...',
      'Extracting contact info...',
    ];
    let msgIdx = 0;
    const msgInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % messages.length;
      setStatusMessage(messages[msgIdx]);
    }, 2000);
    return () => clearInterval(msgInterval);
  }, [searching]);

  const handleSearch = async () => {
    if (!niche.trim() || !location.trim()) {
      addToast('Missing Fields', 'Please enter both a niche and location', 'error');
      return;
    }

    setSearching(true);
    setStatusMessage('Scanning Google Maps...');
    setProgress({ current: 0, total: limit });

    const progressInterval = setInterval(() => {
      setProgress(prev => ({
        ...prev,
        current: Math.min(prev.current + Math.floor(Math.random() * 3) + 1, prev.total),
      }));
    }, 800);

    try {
      const result = await searchLeads(
        niche.trim(), location.trim(), limit, projectId ? Number(projectId) : null
      );
      clearInterval(progressInterval);
      setProgress({ current: limit, total: limit });

      const leads = result.leads || result.results || result || [];
      const count = Array.isArray(leads) ? leads.length : 0;
      addToast('Search Complete', `Found ${count} offline businesses in ${location}`, 'success');
      if (onSearchComplete) onSearchComplete(leads, result.project_id || projectId);
    } catch (err) {
      clearInterval(progressInterval);
      addToast('Search Failed', err.message, 'error');
    } finally {
      setSearching(false);
    }
  };

  const handleBulkSearch = async () => {
    const lines = bulkQueries.trim().split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length === 0) {
      addToast('Missing Queries', 'Enter at least one niche | location pair per line', 'error');
      return;
    }

    const queries = lines.map(line => {
      const parts = line.split('|').map(s => s.trim());
      if (parts.length >= 2) return { niche: parts[0], location: parts[1] };
      // Try splitting on comma or tab
      const altParts = line.split(/[,]\s*/).map(s => s.trim());
      if (altParts.length >= 2) return { niche: altParts[0], location: altParts[1] };
      return null;
    }).filter(Boolean);

    if (queries.length === 0) {
      addToast('Invalid Format', 'Use: Niche | Location (one per line)', 'error');
      return;
    }

    setSearching(true);
    setBulkProgress({ current: 0, total: queries.length });
    setBulkResults([]);
    setStatusMessage('Starting bulk search...');
    const allLeads = [];

    for (let i = 0; i < queries.length; i++) {
      const q = queries[i];
      setBulkProgress({ current: i + 1, total: queries.length });
      setStatusMessage(`Search ${i + 1} of ${queries.length}: ${q.niche} in ${q.location}`);
      setProgress({ current: 0, total: limit });

      const progressInterval = setInterval(() => {
        setProgress(prev => ({
          ...prev,
          current: Math.min(prev.current + Math.floor(Math.random() * 3) + 1, prev.total),
        }));
      }, 500);

      try {
        const result = await searchLeads(q.niche, q.location, limit, projectId ? Number(projectId) : null);
        clearInterval(progressInterval);
        setProgress({ current: limit, total: limit });
        const leads = result.leads || result.results || result || [];
        if (Array.isArray(leads)) allLeads.push(...leads);
        addToast('Query Complete', `"${q.niche}" in ${q.location}: ${Array.isArray(leads) ? leads.length : 0} leads`, 'success');
      } catch (err) {
        clearInterval(progressInterval);
        addToast('Query Failed', `${q.niche} in ${q.location}: ${err.message}`, 'error');
      }
    }

    setBulkProgress({ current: queries.length, total: queries.length });
    setStatusMessage('All searches complete!');
    addToast('Bulk Search Complete', `Found ${allLeads.length} total leads across ${queries.length} searches`, 'success');
    setSearching(false);
    if (onSearchComplete) onSearchComplete(allLeads, projectId || null);
  };

  const progressPct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="table-container">
        <div style={{ padding: '28px 32px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            New Search
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>
            Find offline businesses without websites — easy to convert leads.
          </p>

          {/* Mode Toggle */}
          <div className="toggle-group" style={{ marginBottom: '24px', width: 'fit-content' }}>
            <button className={`toggle-btn ${mode === 'single' ? 'active' : ''}`} onClick={() => setMode('single')}>
              <Search size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              Single Search
            </button>
            <button className={`toggle-btn ${mode === 'bulk' ? 'active' : ''}`} onClick={() => setMode('bulk')}>
              <Layers size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              Bulk Search
            </button>
          </div>

          {mode === 'single' ? (
            <>
              {/* Niche Input */}
              <div className="form-group">
                <label className="form-label">
                  <Target size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                  Niche / Business Type
                </label>
                <input className="form-input" placeholder="e.g. Pool Services, Roofing, Plumbers..." value={niche} onChange={e => setNiche(e.target.value)} disabled={searching} list="niche-suggestions" />
                <datalist id="niche-suggestions">{NICHE_EXAMPLES.map(n => <option key={n} value={n} />)}</datalist>
              </div>

              {/* Location Input */}
              <div className="form-group">
                <label className="form-label">
                  <MapPin size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                  Location
                </label>
                <input className="form-input" placeholder="e.g. Austin, TX" value={location} onChange={e => setLocation(e.target.value)} disabled={searching} list="location-suggestions" />
                <datalist id="location-suggestions">{LOCATIONS.map(l => <option key={l} value={l} />)}</datalist>
              </div>

              {/* Limit + Project Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label"><SlidersHorizontal size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />Max Results</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input type="range" min={10} max={200} step={10} value={limit} onChange={e => setLimit(Number(e.target.value))} disabled={searching} style={{ flex: 1, accentColor: '#F59E0B' }} />
                    <span style={{ background: 'var(--bg-tertiary)', padding: '4px 12px', borderRadius: 'var(--radius-md)', fontSize: '14px', fontWeight: 600, color: 'var(--gold)', minWidth: '40px', textAlign: 'center' }}>{limit}</span>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Project (optional)</label>
                  <select className="form-select" value={projectId} onChange={e => setProjectId(e.target.value)} disabled={searching} style={{ flex: 1 }}>
                    <option value="">No project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  {!showNewProject ? (
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowNewProject(true)} style={{ marginTop: '6px' }} disabled={searching}>+ New Project</button>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <input className="form-input" placeholder="Project name..." value={newProjectName} onChange={e => setNewProjectName(e.target.value)} style={{ flex: 1 }} autoFocus />
                      <button className="btn btn-primary btn-sm" onClick={handleCreateProject}>Create</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setShowNewProject(false)}>Cancel</button>
                    </div>
                  )}
                </div>
              </div>

              <button className="btn btn-primary" onClick={handleSearch} disabled={searching} style={{ width: '100%', justifyContent: 'center', padding: '14px 24px', fontSize: '16px', marginTop: '8px' }}>
                {searching ? <><span className="loading-spinner" />{statusMessage}</> : <><Search size={18} /> Search Offline Businesses</>}
              </button>
            </>
          ) : (
            <>
              {/* Bulk Search */}
              <div className="form-group">
                <label className="form-label">
                  <List size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                  Bulk Queries (one per line — Niche | Location)
                </label>
                <textarea
                  className="form-textarea"
                  placeholder={`Pool Services | Austin, TX\nRoofing | Dallas, TX\nPlumbers | Houston, TX\nLandscaping | Phoenix, AZ`}
                  value={bulkQueries}
                  onChange={e => setBulkQueries(e.target.value)}
                  disabled={searching}
                  style={{ minHeight: '160px', fontFamily: 'var(--font-mono)', fontSize: '13px' }}
                />
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Format: <strong>Niche | Location</strong> (one query per line)
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Project (optional)</label>
                <select className="form-select" value={projectId} onChange={e => setProjectId(e.target.value)} disabled={searching}>
                  <option value="">No project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <button className="btn btn-primary" onClick={handleBulkSearch} disabled={searching} style={{ width: '100%', justifyContent: 'center', padding: '14px 24px', fontSize: '16px', marginTop: '8px' }}>
                {searching ? <><span className="loading-spinner" />{statusMessage}</> : <><Layers size={18} /> Run All Queries</>}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Loading State */}
      {searching && (
        <div className="loading-container animate-fade-in">
          <div className="loading-scanner">
            <div className="loading-scanner-map"><MapPin size={48} /></div>
            <div className="loading-scanner-line" />
          </div>
          <div className="loading-text">{statusMessage}</div>

          {mode === 'bulk' && (
            <div style={{ width: '100%', maxWidth: '400px', marginBottom: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <span>Search {bulkProgress.current} of {bulkProgress.total}</span>
                <span>{bulkProgress.total > 0 ? Math.round((bulkProgress.current / bulkProgress.total) * 100) : 0}%</span>
              </div>
              <div className="progress-bar-container" style={{ height: '6px' }}>
                <div className="progress-bar-fill" style={{ width: `${bulkProgress.total > 0 ? (bulkProgress.current / bulkProgress.total) * 100 : 0}%` }} />
              </div>
            </div>
          )}

          <div style={{ width: '100%', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
              <span>{progress.current} / {progress.total} businesses</span>
              <span>{progressPct}%</span>
            </div>
            <div className="progress-bar-container" style={{ height: '8px' }}>
              <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          <div className="loading-subtext">
            {mode === 'single' ? `Searching for "${niche}" in ${location}...` : 'Processing bulk queries...'}
          </div>
        </div>
      )}
    </div>
  );
}