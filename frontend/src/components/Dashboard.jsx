import { useState, useEffect, useRef, useCallback } from 'react';
import { Users, Globe2, TrendingUp, Download, ArrowUp, ArrowDown, MapPin, Search, Zap } from 'lucide-react';
import { getLeads, updateLead, exportProjectLeads } from '../api';
import { useToast } from './Toast';

function getScoreClass(score) {
  if (score >= 70) return 'high';
  if (score >= 50) return 'mid';
  return 'low';
}

function getStatusClass(status) {
  return status?.toLowerCase().replace(/\s+/g, '-') || 'not-called';
}

function getStatusLabel(status) {
  const map = {
    'not-called': 'Not Called',
    'called': 'Called',
    'interested': 'Interested',
    'closed': 'Closed',
    'not-interested': 'Not Interested',
  };
  return map[status] || status || 'Not Called';
}

function StatCard({ icon: Icon, label, value, subtitle, trend, trendUp, color }) {
  const [displayValue, setDisplayValue] = useState(0);
  const ref = useRef(null);
  const counted = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !counted.current) {
          counted.current = true;
          const target = typeof value === 'number' ? value : parseInt(String(value)) || 0;
          const duration = 1000;
          const steps = 30;
          const increment = target / steps;
          let current = 0;
          const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
              setDisplayValue(target);
              clearInterval(timer);
            } else {
              setDisplayValue(Math.floor(current));
            }
          }, duration / steps);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value]);

  const displayVal = typeof value === 'string' && isNaN(Number(value)) ? value : displayValue;

  return (
    <div className="stat-card" ref={ref}>
      <div className="stat-card-header">
        <span className="stat-card-label">{label}</span>
        <span className={`stat-card-icon ${color}`}>
          <Icon size={18} />
        </span>
      </div>
      <div className="stat-card-value">{displayVal}</div>
      {subtitle && <div className="stat-card-subtitle">{subtitle}</div>}
      {trend && (
        <div className={`stat-card-trend ${trendUp ? 'up' : 'down'}`}>
          {trendUp ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
          {trend}
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ projectId, searchResults }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterOfflineOnly, setFilterOfflineOnly] = useState(false);
  const [sortField, setSortField] = useState('score');
  const [sortDir, setSortDir] = useState('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [minScore, setMinScore] = useState(0);
  const addToast = useToast();

  const loadLeads = useCallback(async () => {
    if (!projectId && !searchResults) return;
    setLoading(true);
    try {
      let data;
      if (searchResults) {
        data = Array.isArray(searchResults) ? searchResults : [];
      } else if (projectId) {
        data = await getLeads(projectId, { min_score: minScore || undefined });
      } else {
        data = [];
      }
      setLeads(data);
    } catch (err) {
      addToast('Error', 'Failed to load leads', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId, searchResults, minScore, addToast]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  // When search results come in, use them directly
  useEffect(() => {
    if (searchResults) {
      setLeads(Array.isArray(searchResults) ? searchResults : []);
    }
  }, [searchResults]);

  const handleStatusChange = async (leadId, newStatus) => {
    try {
      await updateLead(leadId, { status: newStatus });
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
      addToast('Status Updated', `Lead marked as "${getStatusLabel(newStatus)}"`, 'success');
    } catch (err) {
      addToast('Error', err.message, 'error');
    }
  };

  const handleExport = async () => {
    if (!projectId) {
      addToast('No Project', 'Select a project first to export', 'error');
      return;
    }
    try {
      await exportProjectLeads(projectId);
      addToast('Export Started', 'Your CSV export is being generated', 'success');
    } catch (err) {
      addToast('Error', err.message, 'error');
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const filteredAndSorted = [...leads]
    .filter(l => !filterOfflineOnly || !l.website)
    .filter(l => l.score >= minScore)
    .filter(l => !searchQuery || (l.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (l.category || '').toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'score') return ((a.score || 0) - (b.score || 0)) * dir;
      if (sortField === 'name') return (a.name || '').localeCompare(b.name || '') * dir;
      if (sortField === 'rating') return ((a.rating || 0) - (b.rating || 0)) * dir;
      return 0;
    });

  const totalLeads = leads.length;
  const offlineCount = leads.filter(l => !l.website).length;
  const avgScore = totalLeads > 0 ? Math.round(leads.reduce((s, l) => s + (l.score || 0), 0) / totalLeads) : 0;
  const hotCount = leads.filter(l => (l.score || 0) >= 70).length;

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-text">Loading leads...</div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Stats Bar */}
      <div className="stats-grid stagger">
        <StatCard icon={Users} label="Total Leads" value={totalLeads} subtitle={projectId ? `Project #${projectId}` : 'All results'} color="gold" />
        <StatCard icon={Globe2} label="No Website" value={offlineCount} subtitle="Easy-to-convert targets" trend={totalLeads > 0 ? `${Math.round(offlineCount/totalLeads*100)}% of total` : ''} trendUp color="red" />
        <StatCard icon={TrendingUp} label="Avg Closing Chance" value={avgScore > 0 ? `${avgScore}%` : 'N/A'} subtitle="Score weighted average" color="blue" />
        <StatCard icon={Zap} label="Hot Leads" value={hotCount} subtitle="Score ≥ 70" color="green" />
      </div>

      {/* Table */}
      <div className="table-container animate-fade-in-up">
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <div className="search-wrapper">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Search businesses..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '36px' }}
              />
            </div>
            <div className="toggle-group">
              <button
                className={`toggle-btn ${!filterOfflineOnly ? 'active' : ''}`}
                onClick={() => setFilterOfflineOnly(false)}
              >
                All
              </button>
              <button
                className={`toggle-btn ${filterOfflineOnly ? 'active' : ''}`}
                onClick={() => setFilterOfflineOnly(true)}
              >
                No Website
              </button>
            </div>
          </div>
          <div className="table-toolbar-right">
            <select
              className="form-select"
              value={minScore}
              onChange={e => setMinScore(Number(e.target.value))}
              style={{ width: '130px', padding: '6px 30px 6px 10px', fontSize: '12px' }}
            >
              <option value={0}>All Scores</option>
              <option value={70}>Hot (70+)</option>
              <option value={50}>Warm (50+)</option>
            </select>
            <button className="btn btn-secondary btn-sm" onClick={handleExport}>
              <Download size={14} />
              Export CSV
            </button>
          </div>
        </div>

        {filteredAndSorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '16px' }}>No leads found. Run a search to get started.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th onClick={() => handleSort('name')} className={sortField === 'name' ? 'sorted' : ''}>
                  Business {sortField === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th>Category</th>
                <th onClick={() => handleSort('rating')} className={sortField === 'rating' ? 'sorted' : ''}>
                  Rating {sortField === 'rating' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('score')} className={sortField === 'score' ? 'sorted' : ''}>
                  Closing Chance {sortField === 'score' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th>Tags</th>
                <th>Age</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.map((lead, i) => (
                <tr key={lead.id} style={{ animationDelay: `${i * 0.05}s` }}>
                  <td>
                    <div className="business-info">
                      <div className="business-thumb">
                        <div className="business-thumb-placeholder">
                          <MapPin size={16} />
                        </div>
                      </div>
                      <div>
                        <div className="business-name">{lead.name}</div>
                        <div className="business-category">{lead.category || ''}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="tag">{lead.category || 'N/A'}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ color: lead.rating >= 4 ? 'var(--success)' : lead.rating >= 3.5 ? 'var(--gold)' : 'var(--text-muted)' }}>
                        ★
                      </span>
                      {lead.rating || 'N/A'}
                      {lead.reviews != null && (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>({lead.reviews})</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className={`score-badge ${getScoreClass(lead.score)} ${lead.score > 70 ? 'pulse' : ''}`}>
                      {lead.score}%
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {!lead.website && <span className="tag no-website">No Website</span>}
                      {lead.email && <span className="tag has-email">Email Found</span>}
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{lead.business_age || lead.age || 'N/A'}</td>
                  <td>
                    <select
                      className={`status-badge ${getStatusClass(lead.status)}`}
                      value={lead.status || 'not-called'}
                      onChange={e => handleStatusChange(lead.id, e.target.value)}
                      style={{
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 500,
                        padding: '4px 12px',
                        borderRadius: '20px',
                        background: lead.status === 'interested' ? 'rgba(245, 158, 11, 0.15)' :
                                    lead.status === 'called' ? 'rgba(59, 130, 246, 0.15)' :
                                    lead.status === 'closed' ? 'rgba(16, 185, 129, 0.15)' :
                                    lead.status === 'not-interested' ? 'rgba(239, 68, 68, 0.15)' :
                                    'rgba(107, 114, 128, 0.15)',
                        color: lead.status === 'interested' ? 'var(--gold)' :
                               lead.status === 'called' ? 'var(--info)' :
                               lead.status === 'closed' ? 'var(--success)' :
                               lead.status === 'not-interested' ? 'var(--danger)' :
                               'var(--text-muted)',
                      }}
                    >
                      <option value="not-called">Not Called</option>
                      <option value="called">Called</option>
                      <option value="interested">Interested</option>
                      <option value="closed">Closed</option>
                      <option value="not-interested">Not Interested</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}