import React, { useState, useMemo, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Outlet, useLocation, useOutletContext, Navigate } from 'react-router-dom';
import { BarChart3, TrendingUp, Users, Activity, ArrowUpRight, ArrowDownRight, Minus, Search, ChevronLeft, ChevronRight, FileText, AlertTriangle, Download, RefreshCw } from 'lucide-react';
import { downloadCsv } from './csvUtils';
import { generateFullReportPdf } from './pdfExport';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';

import { useDropzone } from 'react-dropzone';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, PieChart, Pie } from 'recharts';
import { OverviewView } from './views/OverviewView';
import { OpportunitiesView } from './views/OpportunitiesView';
import { LossesView } from './views/LossesView';
import { SegmentsView } from './views/SegmentsView';
import { KeywordDetailView } from './views/KeywordDetailView';
import { SortableHeader, type SortConfig } from './components/SortableHeader';
import {
  clearData,
  parseCSVContent,
  loadFromCache,
  loadFromBackend,
  loadSerpstatData,
  getDataStatus,
  getDataInfo,
  getTags,
  getTopMovers,
  getTagSummary,
  getTagTimeline,
  getPositionsHistory,
  ALL_DATES
} from './dataStore';

const queryClient = new QueryClient();

export type SelectionState = {
  keywords: string[];
  tags: string[];
};

export type AppContextType = {
  dateFrom: string;
  dateTo: string;
  setDateFrom: (d: string) => void;
  setDateTo: (d: string) => void;
  selection: SelectionState;
  setSelection: React.Dispatch<React.SetStateAction<SelectionState>>;
};

// ---------------------------------------------------------------------------
// Shared Components
// ---------------------------------------------------------------------------

// SortableHeader now lives in ./components/SortableHeader (shared by the
// legacy in-file components below and the new views/ tables). Re-exported
// here for backward compatibility with anything importing it from App.tsx.
export { SortableHeader, type SortConfig };

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

const Layout = () => {
  const location = useLocation();
  const [dateFrom, setDateFrom] = useState(() => {
    if (ALL_DATES.length > 1) {
      const sorted = [...ALL_DATES].sort();
      return sorted[sorted.length - 2];
    }
    return ALL_DATES[0] || '2025-08-01';
  });
  const [dateTo, setDateTo] = useState(() => {
    if (ALL_DATES.length > 0) {
      const sorted = [...ALL_DATES].sort();
      return sorted[sorted.length - 1];
    }
    return new Date().toISOString().split('T')[0];
  });
  const [selection, setSelection] = useState<SelectionState>({ keywords: [], tags: [] });
  const [resetKey, setResetKey] = useState(0);

  const handleResetFilters = () => {
    if (ALL_DATES.length > 1) {
      const sorted = [...ALL_DATES].sort();
      setDateFrom(sorted[sorted.length - 2]);
      setDateTo(sorted[sorted.length - 1]);
    }
    setSelection({ keywords: [], tags: [] });
    setResetKey(prev => prev + 1);
  };

  const handleStartNewAnalysis = async () => {
    if (window.confirm("Are you sure you want to start a new analysis? The current dataset will be completely wiped from memory.")) {
      // Temporarily remove beforeunload to allow reload without warning
      window.onbeforeunload = null;
      try {
        clearData();
        window.location.href = '/';
      } catch (e) {
        console.error("Failed to clear data", e);
      }
    }
  };

  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);

  const handleExportFullReport = () => {
    setExportingPdf(true);
    try {
      generateFullReportPdf({ dateFrom, dateTo });
    } catch (e) {
      console.error('Failed to generate PDF report', e);
      window.alert('Failed to generate the PDF report. See the browser console for details.');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleLiveSync = async () => {
    setSyncing(true);
    setSyncStatus('Fetching live data from Serpstat MCP...');
    try {
      const res = await fetch('/api/serpstat/live-sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Live sync failed');
      }
      loadSerpstatData(data.keywords, data.allDates);
      queryClient.invalidateQueries();
      setSyncStatus(`Sync Complete (${data.count} keywords)`);
      setResetKey(prev => prev + 1);
      setTimeout(() => setSyncStatus(''), 4000);
    } catch (e: any) {
      setSyncStatus(`Error: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const navigation = [
    { name: 'Overview', href: '/overview', icon: Activity },
    { name: 'Opportunities', href: '/opportunities', icon: TrendingUp },
    { name: 'Losses', href: '/losses', icon: AlertTriangle },
    { name: 'Product Segments', href: '/segments', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <BarChart3 className="w-6 h-6 text-indigo-600 mr-2" />
          <span className="text-lg font-bold text-gray-900">Rank Tracker</span>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="px-3 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${isActive
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                >
                  <item.icon
                    className={`mr-3 flex-shrink-0 h-5 w-5 ${isActive ? 'text-indigo-600' : 'text-gray-400'
                      }`}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="p-4 border-t border-gray-200 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">From</label>
            <select
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
              {[...new Set(ALL_DATES)].sort().map(date => (
                <option key={`from-${date}`} value={date}>{date}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">To</label>
            <select
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
              {[...new Set(ALL_DATES)].sort().map(date => (
                <option key={`to-${date}`} value={date}>{date}</option>
              ))}
            </select>
          </div>
          <div className="pt-4 border-t border-gray-200 mt-4 space-y-2">
            <button
              onClick={handleResetFilters}
              className="w-full flex justify-center items-center px-4 py-2 text-sm font-medium rounded-md text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors"
            >
              Reset All Filters
            </button>
            <button
              onClick={handleStartNewAnalysis}
              className="w-full flex justify-center items-center px-4 py-2 text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
            >
              Clear & Start New
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-8 shadow-sm justify-between">
          <h1 className="text-xl font-semibold text-gray-800 tracking-tight">
            {navigation.find(n => n.href === location.pathname)?.name || 'Dashboard'}
          </h1>
          <div className="flex items-center space-x-4">
            {syncStatus && (
              <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100 animate-pulse">
                {syncStatus}
              </span>
            )}
            <button
              onClick={handleLiveSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing Serpstat MCP...' : 'Sync Live Serpstat Data'}
            </button>
            <button
              onClick={handleExportFullReport}
              disabled={exportingPdf}
              title="Export a consolidated PDF covering Overview, Opportunities, Losses, and Product Segments for the selected date range"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              {exportingPdf ? 'Generating PDF...' : 'Export Full Report (PDF)'}
            </button>
            <span className="text-sm text-gray-500 font-medium border-l border-gray-200 pl-4">Terra Universal SEO Tracker</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet key={resetKey} context={{ dateFrom, dateTo, setDateFrom, setDateTo, selection, setSelection } satisfies AppContextType} />
          </div>
        </main>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Data Status Wrapper & Uploader
// ---------------------------------------------------------------------------

const UploadScreen = ({ onDataLoaded }: { onDataLoaded: () => void }) => {
  const defaultUrl = 'https://docs.google.com/spreadsheets/d/1Le3C8yQFuWIicJ2Y3f-qUJ_Xpxdod74WKhWK9kmZuts/edit?usp=sharing';
  const [url, setUrl] = useState(defaultUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Serpstat MCP state
  const [serpstatConfigured, setSerpstatConfigured] = useState(false);
  const [serpstatProjects, setSerpstatProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [serpstatLoading, setSerpstatLoading] = useState(false);
  const [serpstatProjectsLoading, setSerpstatProjectsLoading] = useState(false);

  // Check Serpstat configuration on mount
  useEffect(() => {
    fetch('/api/serpstat/status')
      .then(r => r.json())
      .then(data => {
        if (data.configured) {
          setSerpstatConfigured(true);
          // Auto-fetch projects
          setSerpstatProjectsLoading(true);
          fetch('/api/serpstat/projects')
            .then(r => r.json())
            .then(pData => {
              setSerpstatProjects(pData.projects || []);
            })
            .catch(err => console.warn('Could not load Serpstat projects:', err))
            .finally(() => setSerpstatProjectsLoading(false));
        }
      })
      .catch(() => { /* Serpstat not available, that is fine */ });
  }, []);

  // Auto-fetch for testing purposes
  useEffect(() => {
    if (url === defaultUrl && !uploading) {
      handleUrlSubmit({ preventDefault: () => { } } as React.FormEvent);
    }
  }, []); // Run once on mount

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    setUploading(true);
    setError('');

    try {
      const text = await acceptedFiles[0].text();
      parseCSVContent(text);
      onDataLoaded();
    } catch (e: any) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false
  });

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    setUploading(true);
    setError('');

    let fetchUrl = url;
    if (url.includes('docs.google.com/spreadsheets')) {
      const matches = url.match(/\/d\/(.*?)(\/|$)/);
      if (matches && matches[1]) {
        fetchUrl = `https://docs.google.com/spreadsheets/d/${matches[1]}/export?format=csv`;
      }
    }

    try {
      const response = await fetch(fetchUrl);
      if (!response.ok) throw new Error("Failed to fetch sheet. Check permissions or URL.");
      const text = await response.text();
      parseCSVContent(text);
      onDataLoaded();
    } catch (e: any) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 max-w-lg w-full">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
            <BarChart3 className="w-8 h-8 text-indigo-600" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">Connect Your Data</h1>
        <p className="text-gray-500 text-center mb-8">Upload a Serpstat CSV export or provide a Google Sheets URL to initialize the tracking dashboard.</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-6 font-medium">
            {error}
          </div>
        )}

        <div className="space-y-8">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Option 1: Drag & Drop CSV</h3>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400 bg-gray-50 hover:bg-gray-100'
                } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <input {...getInputProps()} />
              <FileText className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              {isDragActive ? (
                <p className="text-indigo-600 font-medium">Drop the CSV file here...</p>
              ) : (
                <p className="text-gray-600">
                  <span className="font-semibold text-indigo-600">Click to upload</span> or drag and drop a .csv file
                </p>
              )}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-sm text-gray-500 font-medium">OR</span>
            </div>
          </div>

          <form onSubmit={handleUrlSubmit}>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Option 2: Google Sheets URL</h3>
            <div className="flex gap-3">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="flex-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md py-2.5 px-3 border"
                disabled={uploading}
              />
              <button
                type="submit"
                disabled={!url || uploading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Loading...' : 'Connect'}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">The sheet must be publicly accessible or shared with 'Anyone with the link'.</p>
          </form>

          {serpstatConfigured && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 text-sm text-gray-500 font-medium">OR</span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">Option 3: Fetch from Serpstat</h3>
                <p className="text-xs text-gray-500 mb-3">Pull live rank tracker data directly from your Serpstat account via MCP.</p>
                {serpstatProjectsLoading ? (
                  <div className="text-sm text-gray-500 animate-pulse">Loading projects from Serpstat...</div>
                ) : serpstatProjects.length > 0 ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Select Project</label>
                      <select
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                        className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-2 px-3 border"
                        disabled={serpstatLoading}
                      >
                        <option value="">-- Choose a project --</option>
                        {serpstatProjects.map((proj: any, idx: number) => (
                          <option key={proj.id || idx} value={proj.id || idx}>
                            {proj.name || proj.title || proj.domain || `Project ${proj.id || idx}`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={async () => {
                        if (!selectedProjectId) return;
                        if (!window.confirm('This will replace your current data with live Serpstat data. Continue?')) return;
                        setSerpstatLoading(true);
                        setError('');
                        try {
                          const resp = await fetch('/api/fetch-serpstat', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ projectId: selectedProjectId }),
                          });
                          const data = await resp.json();
                          if (!resp.ok) throw new Error(data.error || 'Failed to fetch from Serpstat');
                          // Hydrate the frontend in-memory store with the data the backend fetched
                          if (data.keywords && data.allDates) {
                            loadSerpstatData(data.keywords, data.allDates);
                          }
                          onDataLoaded();
                        } catch (e: any) {
                          setError(e.message);
                        } finally {
                          setSerpstatLoading(false);
                        }
                      }}
                      disabled={!selectedProjectId || serpstatLoading}
                      className="w-full inline-flex justify-center items-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {serpstatLoading ? 'Fetching from Serpstat...' : 'Fetch Rank Data'}
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-200">
                    No rank tracker projects found. Create a project in Serpstat first.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const ProtectedLayout = () => {
  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ['data-status'],
    queryFn: async () => {
      let currentStatus = getDataStatus();
      if (!currentStatus.loaded) {
        if (await loadFromBackend()) {
          currentStatus = getDataStatus();
        } else if (loadFromCache()) {
          currentStatus = getDataStatus();
        }
      }
      return currentStatus;
    },
  });

  useEffect(() => {
    if (!status?.loaded) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [status?.loaded]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 bg-indigo-200 rounded-full mb-4"></div>
          <div className="text-indigo-600 font-medium">Checking Data Store...</div>
        </div>
      </div>
    );
  }

  if (!status?.loaded) {
    return <UploadScreen onDataLoaded={refetch} />;
  }

  return <Layout />;
};

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export const Dashboard = () => {
  const { dateFrom, dateTo, selection } = useOutletContext<AppContextType>();

  const { data: info } = useQuery({
    queryKey: ['data-info', dateFrom, dateTo, selection],
    queryFn: async () => {
      const baseInfo = getDataInfo();
      const summary = getTagSummary({ date_from: dateFrom, date_to: dateTo, selection });
      return {
        ...baseInfo,
        tagSummary: summary.data,
      };
    },
  });

  const { data: historyData } = useQuery({
    queryKey: ['positions-history-dashboard', dateFrom, dateTo, selection],
    queryFn: async () => {
      return getPositionsHistory({ date_from: dateFrom, date_to: dateTo, limit: 500, selection });
    },
  });

  const movers = historyData?.movers || { raised: 0, dropped: 0, unchanged: 0, noData: 0 };

  const topTags = info?.tagSummary?.slice(0, 8) || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col items-center justify-center text-center">
          <Activity className="h-10 w-10 text-blue-500 mb-3" />
          <h3 className="text-lg font-medium text-gray-900">Keywords Tracked</h3>
          <p className="text-3xl font-bold text-gray-800 mt-2">{info?.totalKeywords?.toLocaleString() || '-'}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-emerald-100 p-6 flex flex-col items-center justify-center text-center">
          <ArrowUpRight className="h-10 w-10 text-emerald-500 mb-3" />
          <h3 className="text-lg font-medium text-gray-900">Improved</h3>
          <p className="text-3xl font-bold text-emerald-600 mt-2">{movers.raised}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-red-100 p-6 flex flex-col items-center justify-center text-center">
          <ArrowDownRight className="h-10 w-10 text-red-500 mb-3" />
          <h3 className="text-lg font-medium text-gray-900">Declined</h3>
          <p className="text-3xl font-bold text-red-600 mt-2">{movers.dropped}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col items-center justify-center text-center">
          <Minus className="h-10 w-10 text-gray-400 mb-3" />
          <h3 className="text-lg font-medium text-gray-900">Unchanged</h3>
          <p className="text-3xl font-bold text-gray-500 mt-2">{movers.unchanged}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-1">Data Coverage</h3>
        <p className="text-sm text-gray-500 mb-4">
          {info?.dateRange?.from} to {info?.dateRange?.to} -- {info?.totalDates} check-in dates
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {topTags.map((t: any) => (
            <div key={t.tag} className="bg-white border border-gray-100 rounded-xl p-4 flex flex-col items-center text-center shadow-sm hover:border-indigo-200 hover:shadow-md transition-all">
              <div className="text-sm font-semibold text-gray-800 truncate w-full mb-3" title={t.tag}>{t.tag}</div>
              <div className="flex w-full justify-around items-center">
                <div className="flex flex-col items-center">
                  <div className="text-lg font-bold text-gray-900">{t.totalVolume.toLocaleString()}</div>
                  <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mt-1">Vol</div>
                </div>
                <div className="w-px h-8 bg-gray-100 mx-2"></div>
                <div className="flex flex-col items-center">
                  <div className={`flex items-center text-lg font-bold ${t.totalNetChange > 0 ? 'text-emerald-500' : t.totalNetChange < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                    {t.totalNetChange > 0 ? <ArrowUpRight className="w-4 h-4 mr-0.5" /> : t.totalNetChange < 0 ? <ArrowDownRight className="w-4 h-4 mr-0.5" /> : <Minus className="w-4 h-4 mr-0.5" />}
                    {Math.abs(t.totalNetChange || 0)}
                  </div>
                  <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mt-1">Net Rank</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Trends Component / Filtered Table View
// ---------------------------------------------------------------------------

const TrendsComponent = ({
  filterType = '',
  defaultSortKey = 'volume',
  defaultSortDir = 'desc',
  title = 'Position History (Top 5 by Volume)'
}: {
  filterType?: string;
  defaultSortKey?: string;
  defaultSortDir?: 'asc' | 'desc';
  title?: string
}) => {
  const { dateFrom, dateTo, selection, setSelection } = useOutletContext<AppContextType>();
  const [keywordSearch, setKeywordSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: defaultSortKey, dir: defaultSortDir });

  const { data: tags } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      return getTags();
    },
  });

  const { data: historyData, isLoading } = useQuery({
    queryKey: ['positions-history', dateFrom, dateTo, keywordSearch, page, sortConfig, filterType, selection],
    queryFn: async () => {
      return getPositionsHistory({
        date_from: dateFrom,
        date_to: dateTo,
        keyword_search: keywordSearch,
        page,
        limit: 10,
        sort: sortConfig.key,
        order: sortConfig.dir,
        filter_type: filterType,
        selection,
      });
    },
  });

  // Build chart data from the top keywords
  const chartData = useMemo(() => {
    if (!historyData?.data) return [];

    const dateMap: Record<string, any> = {};
    const topKeywords = historyData.data.slice(0, 5);

    topKeywords.forEach((item: any) => {
      if (item.positions && typeof item.positions === 'object') {
        Object.entries(item.positions).forEach(([dateStr, pos]: any) => {
          if (pos === null) return;
          if (!dateMap[dateStr]) dateMap[dateStr] = { date: dateStr };
          dateMap[dateStr][item.keyword] = pos;
        });
      }
    });

    return Object.values(dateMap).sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [historyData]);

  const colors = ["#044a63", "#ad4385", "#ffa600", "#f75c5c", "#5480B3", "#D8A130", "#7a4387"];
  const customPieColors = ["#044a63", "#073763", "#2f3971", "#44407b", "#7a4387", "#ad4385", "#d94875", "#f75c5c", "#ff7e3b", "#ffa600"];
  const pagination = historyData?.pagination;

  const tagPieData = useMemo(() => {
    if (!tags || tags.length === 0) return [];
    const sorted = [...tags].sort((a: any, b: any) => b.volume - a.volume);
    const top = sorted.slice(0, 6).map(t => ({ name: t.tag, value: t.volume }));
    const rest = sorted.slice(6);
    if (rest.length > 0) {
      top.push({
        name: 'Other',
        value: rest.reduce((sum, t) => sum + (t.volume || 0), 0)
      });
    }
    return top;
  }, [tags]);

  const toggleSortTrends = (key: string) => {
    setSortConfig(prev => ({
      key, dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc'
    }));
    setPage(1);
  };

  const handleRowClickTrends = (kw: string) => {
    setSelection(prev => {
      const exists = prev.keywords.includes(kw);
      if (exists) {
        return { ...prev, keywords: prev.keywords.filter(k => k !== kw) };
      } else {
        return { ...prev, keywords: [...prev.keywords, kw] };
      }
    });
  };

  const [trendsExporting, setTrendsExporting] = useState(false);
  const exportTrendsCsv = async () => {
    setTrendsExporting(true);
    try {
      const all = await getPositionsHistory({
        date_from: dateFrom,
        date_to: dateTo,
        keyword_search: keywordSearch,
        page: 1,
        limit: 9999,
        sort: sortConfig.key,
        order: sortConfig.dir,
        filter_type: filterType,
        selection,
      });
      const headers = ['Keyword', 'Volume', 'Tags', 'Avg Pos', 'Best Pos', 'Change', 'Trend'];
      const rows = (all.data as any[] || []).map((r: any) => [
        r.keyword,
        r.volume,
        (r.tags as string[] || []).join('; '),
        r.metrics?.avgPos ?? '',
        r.metrics?.bestPos ?? '',
        r.metrics?.netChange ?? '',
        r.metrics?.trend ?? '',
      ]);
      downloadCsv(`trends-${filterType || 'all'}.csv`, headers, rows);
    } finally {
      setTrendsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              <Search className="inline w-3.5 h-3.5 mr-1" />Search Keyword
            </label>
            <input
              type="text"
              value={keywordSearch}
              onChange={e => { setKeywordSearch(e.target.value); setPage(1); }}
              placeholder="e.g. clean room, hepa filter..."
              className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Search Volume Pie */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 col-span-1 min-h-[400px]">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Product Categories</h2>
          <p className="text-xs text-gray-400 mb-4">Search volume volume distribution. Click to filter.</p>
          <div className="h-80 overflow-visible">
            {tagPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <Pie
                    data={tagPieData}
                    cx="50%" cy="50%"
                    innerRadius={0} outerRadius={60}
                    dataKey="value"
                    stroke="#ffffff"
                    strokeWidth={2}
                    labelLine={{ stroke: '#9ca3af', strokeWidth: 1 }}
                    label={({ name, percent }: any) => {
                      const short = name.length > 16 ? name.slice(0, 14) + '..' : name;
                      return `${short} (${(percent * 100).toFixed(0)}%)`;
                    }}
                    onClick={(_: any, index: number) => {
                      const name = tagPieData[index]?.name;
                      if (!name || name === 'Other') return;
                      setSelection(prev => {
                        const exists = prev.tags.includes(name);
                        if (exists) return { ...prev, tags: prev.tags.filter(t => t !== name) };
                        return { ...prev, tags: [...prev.tags, name] };
                      });
                      setPage(1);
                    }}
                    style={{ cursor: 'pointer', fontSize: '11px' }}
                  >
                    {tagPieData.map((entry: any, i: number) => (
                      <Cell
                        key={`cell-${i}`}
                        fill={customPieColors[i % customPieColors.length]}
                        opacity={selection.tags.length > 0 && !selection.tags.includes(entry.name) ? 0.3 : 1}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => new Intl.NumberFormat('en-US').format(Number(value) || 0)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">No data</div>
            )}
          </div>
          {selection.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 justify-center max-w-[400px]">
              <span className="text-xs text-gray-500">Filtered:</span>
              {selection.tags.map(tag => (
                <span key={tag} className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">{tag}</span>
              ))}
              <button onClick={() => { setSelection(prev => ({ ...prev, tags: [] })); setPage(1); }} className="text-xs text-gray-400 hover:text-gray-600 underline">Clear All</button>
            </div>
          )}
        </div>

        {/* Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 col-span-1 lg:col-span-2 min-h-[400px]">
          <h2 className="text-lg font-medium text-gray-900 mb-4">{title}</h2>
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center h-64 border-2 border-dashed border-gray-200 rounded-lg">
              <span className="text-gray-400 font-medium animate-pulse">Loading chart data...</span>
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center h-64 border-2 border-dashed border-gray-200 rounded-lg">
              <span className="text-gray-400 font-medium">No position data for the selected filters</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} dy={10} />
                <YAxis reversed tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} domain={['dataMin - 1', 'dataMax + 1']} label={{ value: 'Position', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#9ca3af' } }} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 500 }}
                  labelStyle={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                {Object.keys(chartData[0] || {}).filter(k => k !== 'date').map((key, i) => (
                  <Line type="monotone" key={key} dataKey={key} stroke={colors[i % colors.length]} strokeWidth={2} dot={false} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Keyword Details</h3>
          <div className="flex items-center gap-3">
            {pagination && (
              <span className="text-sm text-gray-500">
                Showing {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total.toLocaleString()}
              </span>
            )}
            <button
              onClick={exportTrendsCsv}
              disabled={trendsExporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 bg-white hover:bg-gray-50 hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" />
              {trendsExporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-4 w-10">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    checked={!!(historyData?.data && historyData.data.length > 0 && historyData.data.every((r: any) => selection.keywords.includes(r.keyword)))}
                    onChange={(e) => {
                      if (!historyData?.data) return;
                      const allVisible = historyData.data.map((r: any) => r.keyword);
                      if (e.target.checked) {
                        setSelection(prev => ({ ...prev, keywords: Array.from(new Set([...prev.keywords, ...allVisible])) }));
                      } else {
                        setSelection(prev => ({ ...prev, keywords: prev.keywords.filter(k => !allVisible.includes(k)) }));
                      }
                    }}
                  />
                </th>
                <SortableHeader label="Keyword" sortKey="keyword" current={sortConfig} onSort={toggleSortTrends} />
                <SortableHeader label="Volume" sortKey="volume" current={sortConfig} onSort={toggleSortTrends} align="right" />
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tags</th>
                <SortableHeader label="Avg Pos" sortKey="avgPos" current={sortConfig} onSort={toggleSortTrends} align="right" />
                <SortableHeader label="Best" sortKey="bestPos" current={sortConfig} onSort={toggleSortTrends} align="right" />
                <SortableHeader label="Change" sortKey="netChange" current={sortConfig} onSort={toggleSortTrends} align="right" />
                <SortableHeader label="Trend" sortKey="trend" current={sortConfig} onSort={toggleSortTrends} />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-sm font-medium text-gray-500 animate-pulse">Loading keywords...</td></tr>
              ) : !historyData?.data || historyData.data.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-sm font-medium text-gray-500">No keywords match your filters</td></tr>
              ) : (historyData.data as any[]).map((row: any, i: number) => {
                const change = row.metrics?.netChange || 0;
                const changeStr = change > 0 ? `+${change}` : `${change}`;
                const isSelected = selection.keywords.includes(row.keyword);
                return (
                  <tr
                    key={i}
                    onClick={() => handleRowClickTrends(row.keyword)}
                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50 border-l-4 border-indigo-500 hover:bg-indigo-100' : 'hover:bg-gray-50 border-l-4 border-transparent'}`}
                  >
                    <td className="px-4 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        checked={isSelected}
                        onChange={() => handleRowClickTrends(row.keyword)}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{row.keyword}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium text-right">{row.volume.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex flex-wrap gap-1">
                        {row.tags?.slice(0, 2).map((t: string) => (
                          <span key={t} className="px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">{t}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium text-right">{row.metrics?.avgPos || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium text-right">{row.metrics?.bestPos || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {row.metrics?.trend === 'no data' ? (
                        <span className="text-gray-400 text-xs">--</span>
                      ) : change > 0 ? (
                        <span className="text-emerald-600 flex items-center font-bold px-2 py-1 bg-emerald-50 rounded-md w-max"><ArrowUpRight className="w-4 h-4 mr-1" /> {changeStr}</span>
                      ) : change < 0 ? (
                        <span className="text-red-600 flex items-center font-bold px-2 py-1 bg-red-50 rounded-md w-max"><ArrowDownRight className="w-4 h-4 mr-1" /> {changeStr}</span>
                      ) : (
                        <span className="text-gray-500 flex items-center font-bold px-2 py-1 bg-gray-50 rounded-md w-max"><Minus className="w-4 h-4 mr-1" /> 0</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm capitalize">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${row.metrics?.trend === 'improving' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                        row.metrics?.trend === 'declining' ? 'bg-red-100 text-red-700 border border-red-200' :
                          row.metrics?.trend === 'no data' ? 'bg-amber-50 text-amber-600 border border-amber-200' :
                            'bg-gray-100 text-gray-700 border border-gray-200'
                        }`}>
                        {row.metrics?.trend === 'no data' ? 'No Data' : (row.metrics?.trend || 'Flat')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="p-4 border-t border-gray-200 flex items-center justify-between">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="flex items-center px-3 py-1.5 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
            </button>
            <span className="text-sm text-gray-500">Page {pagination.page} of {pagination.totalPages}</span>
            <button
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(p => p + 1)}
              className="flex items-center px-3 py-1.5 text-sm font-medium rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const TrendsView = () => <TrendsComponent />;
export const DeclinesView = () => <TrendsComponent filterType="declines" defaultSortKey="netChange" defaultSortDir="asc" title="Biggest Declines (Top 5)" />;
export const ImprovementsView = () => <TrendsComponent filterType="improvements" defaultSortKey="volume" defaultSortDir="desc" title="Biggest Improvements (Top 5)" />;
export const FirstPageView = () => <TrendsComponent filterType="first_page" defaultSortKey="volume" defaultSortDir="desc" title="Rank First Page (Top 5 Volume)" />;
export const Top3View = () => <TrendsComponent filterType="top_3" defaultSortKey="volume" defaultSortDir="desc" title="Rank Top 3 (Top 5 Volume)" />;

// ---------------------------------------------------------------------------
// Movers View
// ---------------------------------------------------------------------------

export const MoversView = () => {
  const { dateFrom, dateTo } = useOutletContext<AppContextType>();
  const [direction, setDirection] = useState('all');
  const [keywordSearch, setKeywordSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'volume', dir: 'desc' });

  const { data: moversData, isLoading } = useQuery({
    queryKey: ['top-movers', dateFrom, dateTo, direction],
    queryFn: async () => {
      return getTopMovers({ date_from: dateFrom, date_to: dateTo, direction, limit: 30 });
    },
  });

  const { data: historyData } = useQuery({
    queryKey: ['positions-history-movers', dateFrom, dateTo],
    queryFn: async () => {
      return getPositionsHistory({ date_from: dateFrom, date_to: dateTo, limit: 500 });
    },
  });

  const movers = historyData?.movers || { raised: 0, dropped: 0, unchanged: 0, noData: 0 };

  const items = useMemo(() => {
    let data = moversData?.data || [];
    if (keywordSearch) {
      const q = keywordSearch.toLowerCase();
      data = data.filter((t: any) => t.keyword.toLowerCase().includes(q));
    }
    return [...data].sort((a, b) => {
      let av, bv;
      if (sortConfig.key === 'keyword' || sortConfig.key === 'volume') {
        av = a[sortConfig.key];
        bv = b[sortConfig.key];
      } else {
        av = (a.metrics as any)?.[sortConfig.key] ?? 0;
        bv = (b.metrics as any)?.[sortConfig.key] ?? 0;
      }
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : (av as number) - (bv as number);
      return sortConfig.dir === 'asc' ? cmp : -cmp;
    });
  }, [moversData, keywordSearch, sortConfig]);

  const toggleSortMovers = (key: string) => {
    setSortConfig(prev => ({
      key, dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc'
    }));
  };

  const handleRowClickMovers = (keyword: string) => {
    setKeywordSearch(keyword === keywordSearch ? '' : keyword);
  };

  const exportMoversCsv = () => {
    const headers = ['Keyword', 'Volume', 'Tags', 'Start Pos', 'End Pos', 'Net Change', 'Avg Pos', 'Trend'];
    const rows = items.map((r: any) => [
      r.keyword,
      r.volume,
      (r.tags as string[] || []).join('; '),
      r.metrics?.startPos ?? '',
      r.metrics?.endPos ?? '',
      r.metrics?.netChange ?? '',
      r.metrics?.avgPos ?? '',
      r.metrics?.trend ?? '',
    ]);
    downloadCsv('movers.csv', headers, rows);
  };

  // Chart data for top movers
  const barData = useMemo(() => {
    return items.slice(0, 15).map((item: any) => ({
      keyword: item.keyword.length > 20 ? item.keyword.slice(0, 20) + '...' : item.keyword,
      change: item.metrics.netChange,
    }));
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-emerald-100 p-6 flex flex-col items-center justify-center text-center">
          <h3 className="text-lg font-medium text-gray-900">Improved</h3>
          <p className="text-4xl font-bold text-emerald-500 mt-3">{movers.raised}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-red-100 p-6 flex flex-col items-center justify-center text-center">
          <h3 className="text-lg font-medium text-gray-900">Declined</h3>
          <p className="text-4xl font-bold text-red-500 mt-3">{movers.dropped}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col items-center justify-center text-center">
          <h3 className="text-lg font-medium text-gray-900">Unchanged</h3>
          <p className="text-4xl font-bold text-gray-500 mt-3">{movers.unchanged}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-amber-100 p-6 flex flex-col items-center justify-center text-center">
          <h3 className="text-lg font-medium text-gray-900">No Data</h3>
          <p className="text-4xl font-bold text-amber-500 mt-3">{movers.noData}</p>
        </div>
      </div>

      {/* Direction & Search filter */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex gap-2">
          {[
            { key: 'all', label: 'All Movers' },
            { key: 'raised', label: 'Improved Only' },
            { key: 'dropped', label: 'Declined Only' },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => setDirection(opt.key)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${direction === opt.key
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="bg-white px-3 py-1.5 rounded-lg shadow-sm border border-gray-300 flex items-center min-w-[250px]">
          <Search className="w-4 h-4 text-gray-400 mr-2" />
          <input
            type="text"
            value={keywordSearch}
            onChange={e => setKeywordSearch(e.target.value)}
            placeholder="Filter specific keywords..."
            className="flex-1 text-sm border-0 focus:ring-0 p-0 outline-none"
          />
        </div>
      </div>

      {/* Bar chart */}
      {barData.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Position Changes</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="keyword" tick={{ fontSize: 11, fill: '#374151' }} width={100} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
              <Bar dataKey="change" radius={[0, 4, 4, 0]}>
                {barData.map((entry: any, index: number) => (
                  <Cell key={index} fill={entry.change > 0 ? '#10b981' : entry.change < 0 ? '#ef4444' : '#9ca3af'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Movers table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">
            {direction === 'raised' ? 'Most Improved Keywords' : direction === 'dropped' ? 'Most Declined Keywords' : 'Largest Position Changes'}
          </h3>
          <button
            onClick={exportMoversCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 bg-white hover:bg-gray-50 hover:border-gray-400 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left">
            <thead className="bg-gray-50">
              <tr>
                <SortableHeader label="Keyword" sortKey="keyword" current={sortConfig} onSort={toggleSortMovers} />
                <SortableHeader label="Volume" sortKey="volume" current={sortConfig} onSort={toggleSortMovers} align="right" />
                <SortableHeader label="Start Pos" sortKey="startPos" current={sortConfig} onSort={toggleSortMovers} align="right" />
                <SortableHeader label="End Pos" sortKey="endPos" current={sortConfig} onSort={toggleSortMovers} align="right" />
                <SortableHeader label="Net Change" sortKey="netChange" current={sortConfig} onSort={toggleSortMovers} align="right" />
                <SortableHeader label="Avg Pos" sortKey="avgPos" current={sortConfig} onSort={toggleSortMovers} align="right" />
                <SortableHeader label="Trend" sortKey="trend" current={sortConfig} onSort={toggleSortMovers} />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-sm font-medium text-gray-500 animate-pulse">Loading movers...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-sm font-medium text-gray-500">No movers found for this period</td></tr>
              ) : items.map((row: any, i: number) => {
                const change = row.metrics?.netChange || 0;
                const changeStr = change > 0 ? `+${change}` : `${change}`;
                const isSelected = row.keyword === keywordSearch;
                return (
                  <tr
                    key={i}
                    onClick={() => handleRowClickMovers(row.keyword)}
                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50 hover:bg-indigo-100' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {row.keyword}
                      <div className="flex gap-1 mt-1">
                        {row.tags?.slice(0, 2).map((t: string) => (
                          <span key={t} className="px-1 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">{t}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium text-right">{row.volume.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium text-right">{row.metrics?.startPos ?? '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium text-right">{row.metrics?.endPos ?? '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {change > 0 ? (
                        <span className="text-emerald-600 flex items-center font-bold px-2 py-1 bg-emerald-50 rounded-md w-max"><ArrowUpRight className="w-4 h-4 mr-1" /> {changeStr}</span>
                      ) : change < 0 ? (
                        <span className="text-red-600 flex items-center font-bold px-2 py-1 bg-red-50 rounded-md w-max"><ArrowDownRight className="w-4 h-4 mr-1" /> {changeStr}</span>
                      ) : (
                        <span className="text-gray-500 flex items-center font-bold px-2 py-1 bg-gray-50 rounded-md w-max"><Minus className="w-4 h-4 mr-1" /> 0</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium text-right">{row.metrics?.avgPos || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm capitalize">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${row.metrics?.trend === 'improving' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                        row.metrics?.trend === 'declining' ? 'bg-red-100 text-red-700 border border-red-200' :
                          'bg-gray-100 text-gray-700 border border-gray-200'
                        }`}>
                        {row.metrics?.trend || 'Flat'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tags View (replaces Competitors)
// ---------------------------------------------------------------------------

const TAG_COLORS = ["#044a63", "#ad4385", "#ffa600", "#f75c5c", "#5480B3", "#D8A130", "#7a4387", "#d94875"];

export const TagsView = () => {
  const { dateFrom, dateTo } = useOutletContext<AppContextType>();
  const [tagSearch, setTagSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'totalVolume', dir: 'desc' });

  const { data: tagData, isLoading } = useQuery({
    queryKey: ['tag-summary', dateFrom, dateTo],
    queryFn: () => getTagSummary({ date_from: dateFrom, date_to: dateTo }),
  });

  const { data: timelineData } = useQuery({
    queryKey: ['tag-timeline', dateFrom, dateTo],
    queryFn: () => getTagTimeline({ date_from: dateFrom, date_to: dateTo, maxTags: 8 }),
  });

  const items = useMemo(() => {
    let data = tagData?.data || [];
    if (tagSearch) {
      const q = tagSearch.toLowerCase();
      data = data.filter((t: any) => t.tag.toLowerCase().includes(q));
    }
    return [...data].sort((a, b) => {
      const av = (a as any)[sortConfig.key] ?? 0;
      const bv = (b as any)[sortConfig.key] ?? 0;
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : (av as number) - (bv as number);
      return sortConfig.dir === 'asc' ? cmp : -cmp;
    });
  }, [tagData, tagSearch, sortConfig]);

  const toggleSort = (key: string) => {
    setSortConfig(prev => ({
      key, dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc'
    }));
  };

  const handleRowClick = (tag: string) => {
    setTagSearch(tag === tagSearch ? '' : tag);
  };

  const barData = useMemo(() =>
    (tagData?.data || []).slice(0, 10).map((t: any) => ({
      tag: t.tag.length > 18 ? t.tag.slice(0, 18) + '...' : t.tag,
      volume: t.totalVolume,
      keywords: t.keywords,
    }))
  , [tagData]);

  const exportTagsCsv = () => {
    const headers = ['Category', 'Keywords', 'Total Volume', 'Avg Position', 'Raised', 'Dropped', 'Unchanged'];
    const rows = items.map((r: any) => [
      r.tag, r.keywords, r.totalVolume, r.avgPosition, r.raised, r.dropped, r.unchanged,
    ]);
    downloadCsv('product-categories.csv', headers, rows);
  };

  const timelineTags = timelineData?.tags || [];
  const timelineRows = timelineData?.timeline || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Product Categories</h2>
        <p className="text-sm text-gray-500 mb-4">Performance breakdown by category tag, including volume, keyword count, and rank movement trends.</p>
        <div className="flex items-center gap-3">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={tagSearch}
            onChange={e => setTagSearch(e.target.value)}
            placeholder="Filter categories by name..."
            className="flex-1 text-sm border-0 focus:ring-0 p-1 outline-none"
          />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Bar chart - volume by category */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
          <h3 className="text-base font-semibold text-gray-900 mb-1">Volume by Category (Top 10)</h3>
          <p className="text-xs text-gray-400 mb-4">Total search volume and keyword count per category.</p>
          {isLoading ? (
            <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
              <span className="text-gray-400 font-medium animate-pulse">Loading...</span>
            </div>
          ) : barData.length === 0 ? (
            <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
              <span className="text-gray-400 font-medium">No data</span>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="tag" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} dy={10} angle={-20} textAnchor="end" />
                  <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '16px', fontSize: '12px' }} />
                  <Bar yAxisId="left" dataKey="volume" fill="#044a63" radius={[4, 4, 0, 0]} name="Total Volume" />
                  <Bar yAxisId="right" dataKey="keywords" fill="#ad4385" radius={[4, 4, 0, 0]} name="Keywords" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Timeline chart - avg position by category */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-3">
          <h3 className="text-base font-semibold text-gray-900 mb-1">Avg Position Trend by Category</h3>
          <p className="text-xs text-gray-400 mb-4">Average ranking position over time for top 8 categories. Lower is better.</p>
          {isLoading ? (
            <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
              <span className="text-gray-400 font-medium animate-pulse">Loading...</span>
            </div>
          ) : timelineRows.length === 0 ? (
            <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
              <span className="text-gray-400 font-medium">No timeline data available</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={timelineRows} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  dy={10}
                />
                <YAxis
                  reversed
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  domain={['dataMin - 1', 'dataMax + 1']}
                  label={{ value: 'Avg Position', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#9ca3af' } }}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 500 }}
                  labelStyle={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '16px', fontSize: '11px' }} />
                {timelineTags.map((tag, i) => (
                  <Line
                    key={tag}
                    type="monotone"
                    dataKey={tag}
                    stroke={TAG_COLORS[i % TAG_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 2, fill: TAG_COLORS[i % TAG_COLORS.length] }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">All Categories</h3>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Showing {items.length} categories</span>
            <button
              onClick={exportTagsCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 bg-white hover:bg-gray-50 hover:border-gray-400 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left">
            <thead className="bg-gray-50">
              <tr>
                <SortableHeader label="Category" sortKey="tag" current={sortConfig} onSort={toggleSort} />
                <SortableHeader label="Keywords" sortKey="keywords" current={sortConfig} onSort={toggleSort} align="right" />
                <SortableHeader label="Total Volume" sortKey="totalVolume" current={sortConfig} onSort={toggleSort} align="right" />
                <SortableHeader label="Avg Position" sortKey="avgPosition" current={sortConfig} onSort={toggleSort} align="right" />
                <SortableHeader label="Raised" sortKey="raised" current={sortConfig} onSort={toggleSort} align="right" />
                <SortableHeader label="Dropped" sortKey="dropped" current={sortConfig} onSort={toggleSort} align="right" />
                <SortableHeader label="Unchanged" sortKey="unchanged" current={sortConfig} onSort={toggleSort} align="right" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-sm font-medium text-gray-500 animate-pulse">Loading...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-sm font-medium text-gray-500">No data</td></tr>
              ) : items.map((row: any, i: number) => {
                const isSelected = row.tag === tagSearch;
                return (
                  <tr
                    key={i}
                    onClick={() => handleRowClick(row.tag)}
                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50 hover:bg-indigo-100' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{row.tag}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium text-right">{row.keywords}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium text-right">{row.totalVolume.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium text-right">{row.avgPosition}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-emerald-600 font-bold text-right">{row.raised}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-bold text-right">{row.dropped}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium text-right">{row.unchanged}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/" element={<ProtectedLayout />}>
            <Route index element={<Navigate to="/overview" replace />} />
            <Route path="overview" element={<OverviewView />} />
            <Route path="opportunities" element={<OpportunitiesView />} />
            <Route path="losses" element={<LossesView />} />
            <Route path="segments" element={<SegmentsView />} />
            <Route path="keyword/:keywordId" element={<KeywordDetailView />} />

            {/* Legacy Route Compatibility Redirects */}
            <Route path="seo-overview" element={<Navigate to="/overview" replace />} />
            <Route path="dashboard" element={<Navigate to="/overview" replace />} />
            <Route path="trends" element={<Navigate to="/overview" replace />} />
            <Route path="movers" element={<Navigate to="/opportunities" replace />} />
            <Route path="declines" element={<Navigate to="/losses" replace />} />
            <Route path="improvements" element={<Navigate to="/opportunities" replace />} />
            <Route path="high-impact-items" element={<Navigate to="/opportunities" replace />} />
            <Route path="first-page" element={<Navigate to="/opportunities" replace />} />
            <Route path="top-3" element={<Navigate to="/opportunities" replace />} />
            <Route path="tags" element={<Navigate to="/segments" replace />} />
          </Route>
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}
