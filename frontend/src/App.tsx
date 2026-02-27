import React, { useState, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Outlet, useLocation, useOutletContext } from 'react-router-dom';
import { BarChart3, TrendingUp, Users, Activity, ArrowUpRight, ArrowDownRight, Minus, Search, ChevronLeft, ChevronRight, Filter, FileText, ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, PieChart, Pie, Sector } from 'recharts';
import ReportView from './ReportView';

axios.defaults.baseURL = 'http://localhost:3001';

const queryClient = new QueryClient();

export type AppContextType = {
  dateFrom: string;
  dateTo: string;
  setDateFrom: (d: string) => void;
  setDateTo: (d: string) => void;
};

// ---------------------------------------------------------------------------
// Shared Components
// ---------------------------------------------------------------------------

export type SortConfig = { key: string; dir: 'asc' | 'desc' };

export function SortableHeader({
  label, sortKey, current, onSort, align = 'left',
}: {
  label: string; sortKey: string; current: SortConfig; onSort: (key: string) => void; align?: 'left' | 'right';
}) {
  const isActive = current.key === sortKey;
  return (
    <th
      className={`px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100 transition-colors ${align === 'right' ? 'text-right' : 'text-left'}`}
      onClick={() => onSort(sortKey)}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse justify-start' : ''}`}>
        {label}
        {isActive ? (
          current.dir === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-indigo-600" /> : <ChevronDown className="w-3.5 h-3.5 text-indigo-600" />
        ) : (
          <ArrowUpDown className="w-3 h-3 text-gray-300" />
        )}
      </span>
    </th>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

const Layout = () => {
  const location = useLocation();
  const [dateFrom, setDateFrom] = useState('2025-05-15');
  const [dateTo, setDateTo] = useState('2025-08-15');

  const navigation = [
    { name: 'SEO Report', href: '/', icon: FileText },
    { name: 'Dashboard', href: '/dashboard', icon: Activity },
    { name: 'Trends', href: '/trends', icon: TrendingUp },
    { name: 'Movers', href: '/movers', icon: ArrowUpRight },
    { name: 'Biggest Declines', href: '/declines', icon: ArrowDownRight },
    { name: 'Biggest Improvements', href: '/improvements', icon: ArrowUpRight },
    { name: 'First Page', href: '/first-page', icon: FileText },
    { name: 'Top 3', href: '/top-3', icon: FileText },
    { name: 'Tags', href: '/tags', icon: Users },
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
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {[
              { label: '30d', days: 30 },
              { label: '90d', days: 90 },
              { label: '6mo', days: 180 },
              { label: '1yr', days: 365 },
              { label: 'All', days: 0 },
            ].map(preset => (
              <button
                key={preset.label}
                onClick={() => {
                  const baseDate = new Date('2025-08-15T00:00:00Z');
                  if (preset.days === 0) {
                    setDateFrom('2023-07-18');
                  } else {
                    setDateFrom(new Date(baseDate.getTime() - preset.days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
                  }
                  setDateTo('2025-08-15');
                }}
                className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-600 hover:bg-indigo-100 hover:text-indigo-700 transition-colors"
              >
                {preset.label}
              </button>
            ))}
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
            <span className="text-sm text-gray-500 font-medium">Terra Universal SEO Tracker</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet context={{ dateFrom, dateTo, setDateFrom, setDateTo } satisfies AppContextType} />
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
  const [url, setUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', acceptedFiles[0]);

    try {
      await axios.post('/api/upload-csv', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
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

    try {
      await axios.post('/api/upload-csv-url', { url });
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
        </div>
      </div>
    </div>
  );
};

const ProtectedLayout = () => {
  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ['data-status'],
    queryFn: async () => {
      const { data } = await axios.get('/api/data-status');
      return data;
    },
  });

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

const Dashboard = () => {
  const { dateFrom, dateTo } = useOutletContext<AppContextType>();

  const { data: info } = useQuery({
    queryKey: ['data-info'],
    queryFn: async () => {
      const { data } = await axios.get('/api/data-info');
      return data;
    },
  });

  const { data: historyData } = useQuery({
    queryKey: ['positions-history-dashboard', dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await axios.get('/api/positions-history', {
        params: { date_from: dateFrom, date_to: dateTo, limit: 500 }
      });
      return data;
    },
  });

  const movers = historyData?.movers || { raised: 0, dropped: 0, unchanged: 0, noData: 0 };

  const topTags = info?.tags?.slice(0, 8) || [];

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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {topTags.map((t: any) => (
            <div key={t.tag} className="border border-gray-100 rounded-lg p-3 text-center hover:border-indigo-200 transition-colors">
              <div className="text-sm font-semibold text-gray-700 truncate" title={t.tag}>{t.tag}</div>
              <div className="text-lg font-bold text-indigo-600 mt-1">{t.count}</div>
              <div className="text-xs text-gray-400">keywords</div>
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
  const { dateFrom, dateTo } = useOutletContext<AppContextType>();
  const [keywordSearch, setKeywordSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: defaultSortKey, dir: defaultSortDir });

  const { data: tags } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data } = await axios.get('/api/tags');
      return data;
    },
  });

  const { data: historyData, isLoading } = useQuery({
    queryKey: ['positions-history', dateFrom, dateTo, selectedTag, keywordSearch, page, sortConfig, filterType],
    queryFn: async () => {
      const { data } = await axios.get('/api/positions-history', {
        params: {
          date_from: dateFrom,
          date_to: dateTo,
          tag: selectedTag,
          keyword_search: keywordSearch,
          page,
          limit: 10,
          sort: sortConfig.key,
          order: sortConfig.dir,
          filter_type: filterType,
        }
      });
      return data;
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

  const colors = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];
  const pagination = historyData?.pagination;

  const toggleSortTrends = (key: string) => {
    setSortConfig(prev => ({
      key, dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc'
    }));
    setPage(1);
  };

  const handleRowClickTrends = (keyword: string) => {
    setKeywordSearch(keyword === keywordSearch ? '' : keyword);
    setPage(1);
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
          <div className="min-w-[200px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              <Filter className="inline w-3.5 h-3.5 mr-1" />Tag Filter
            </label>
            <select
              value={selectedTag}
              onChange={e => { setSelectedTag(e.target.value); setPage(1); }}
              className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Tags</option>
              {(tags || []).map((t: any) => (
                <option key={t.tag} value={t.tag}>{t.tag} ({t.count})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
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

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Keyword Details</h3>
          {pagination && (
            <span className="text-sm text-gray-500">
              Showing {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total.toLocaleString()}
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left">
            <thead className="bg-gray-50">
              <tr>
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
              ) : !historyData?.data?.length ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-sm font-medium text-gray-500">No keywords match your filters</td></tr>
              ) : historyData.data.map((row: any, i: number) => {
                const change = row.metrics?.netChange || 0;
                const changeStr = change > 0 ? `+${change}` : `${change}`;
                const isSelected = row.keyword === keywordSearch;
                return (
                  <tr
                    key={i}
                    onClick={() => handleRowClickTrends(row.keyword)}
                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50 hover:bg-indigo-100' : 'hover:bg-gray-50'}`}
                  >
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
export const ImprovementsView = () => <TrendsComponent filterType="improvements" defaultSortKey="netChange" defaultSortDir="desc" title="Biggest Improvements (Top 5)" />;
export const FirstPageView = () => <TrendsComponent filterType="first_page" defaultSortKey="volume" defaultSortDir="desc" title="First Page Keywords (Top 5 Volume)" />;
export const Top3View = () => <TrendsComponent filterType="top_3" defaultSortKey="volume" defaultSortDir="desc" title="Top 3 Keywords (Top 5 Volume)" />;

// ---------------------------------------------------------------------------
// Movers View
// ---------------------------------------------------------------------------

const MoversView = () => {
  const { dateFrom, dateTo } = useOutletContext<AppContextType>();
  const [direction, setDirection] = useState('all');
  const [keywordSearch, setKeywordSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'netChange', dir: 'desc' });

  const { data: moversData, isLoading } = useQuery({
    queryKey: ['top-movers', dateFrom, dateTo, direction],
    queryFn: async () => {
      const { data } = await axios.get('/api/top-movers', {
        params: { date_from: dateFrom, date_to: dateTo, direction, limit: 30 }
      });
      return data;
    },
  });

  const { data: historyData } = useQuery({
    queryKey: ['positions-history-movers', dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await axios.get('/api/positions-history', {
        params: { date_from: dateFrom, date_to: dateTo, limit: 500 }
      });
      return data;
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
        av = a.metrics?.[sortConfig.key] ?? 0;
        bv = b.metrics?.[sortConfig.key] ?? 0;
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
        <div className="p-5 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            {direction === 'raised' ? 'Most Improved Keywords' : direction === 'dropped' ? 'Most Declined Keywords' : 'Largest Position Changes'}
          </h3>
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

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  return (
    <g>
      <text x={cx} y={cy - 10} textAnchor="middle" fill="#374151" fontSize={13} fontWeight={600}>
        {payload.name}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="#6b7280" fontSize={11}>
        {value.toLocaleString()} ({(percent * 100).toFixed(1)}%)
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 8} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={outerRadius + 12} outerRadius={outerRadius + 16} startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
};

const TagsView = () => {
  const { dateFrom, dateTo } = useOutletContext<AppContextType>();
  const [tagSearch, setTagSearch] = useState('');
  const [activePie, setActivePie] = useState(0);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'totalVolume', dir: 'desc' });

  const { data: tagData, isLoading } = useQuery({
    queryKey: ['tag-summary', dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await axios.get('/api/tag-summary', {
        params: { date_from: dateFrom, date_to: dateTo }
      });
      return data;
    },
  });

  const items = useMemo(() => {
    let data = tagData?.data || [];
    if (tagSearch) {
      const q = tagSearch.toLowerCase();
      data = data.filter((t: any) => t.tag.toLowerCase().includes(q));
    }

    // sorting
    return [...data].sort((a, b) => {
      const av = a[sortConfig.key] ?? 0;
      const bv = b[sortConfig.key] ?? 0;
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

  // Chart for top tags by volume
  const barData = items.slice(0, 10).map((t: any) => ({
    tag: t.tag.length > 18 ? t.tag.slice(0, 18) + '...' : t.tag,
    volume: t.totalVolume,
    keywords: t.keywords,
  }));

  // Pie chart for aggregated movers of filtered tags
  const pieData = useMemo(() => {
    let raised = 0, dropped = 0, unchanged = 0;
    items.forEach((t: any) => {
      raised += t.raised;
      dropped += t.dropped;
      unchanged += t.unchanged;
    });
    return [
      { name: 'Improved', value: raised, fill: '#10b981' },
      { name: 'Declined', value: dropped, fill: '#ef4444' },
      { name: 'Unchanged', value: unchanged, fill: '#9ca3af' },
    ].filter(d => d.value > 0);
  }, [items]);

  return (
    <div className="space-y-6">
      {/* Search Filter */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
        <Search className="w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={tagSearch}
          onChange={e => setTagSearch(e.target.value)}
          placeholder="Filter tags by name..."
          className="flex-1 text-sm border-0 focus:ring-0 p-1 outline-none"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-medium text-gray-900 mb-6">Volume & Keywords (Top 10)</h2>
          {isLoading ? (
            <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
              <span className="text-gray-400 font-medium animate-pulse">Loading tags...</span>
            </div>
          ) : barData.length === 0 ? (
            <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
              <span className="text-gray-400 font-medium">No tag data</span>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="tag" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} dy={10} angle={-15} />
                  <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '13px' }} />
                  <Bar yAxisId="left" dataKey="volume" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Total Volume" />
                  <Bar yAxisId="right" dataKey="keywords" fill="#10b981" radius={[4, 4, 0, 0]} name="Keywords Count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Movers Pie Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-medium text-gray-900 mb-6">Movement Distribution (All Filtered)</h2>
          {isLoading ? (
            <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
              <span className="text-gray-400 font-medium animate-pulse">Loading tags...</span>
            </div>
          ) : pieData.length === 0 ? (
            <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
              <span className="text-gray-400 font-medium">No movement data</span>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    activeIndex={activePie}
                    activeShape={renderActiveShape}
                    data={pieData}
                    cx="50%" cy="50%"
                    innerRadius={60} outerRadius={80}
                    dataKey="value"
                    onMouseEnter={(_: any, index: number) => setActivePie(index)}
                  >
                    {pieData.map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">All Tags Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left">
            <thead className="bg-gray-50">
              <tr>
                <SortableHeader label="Tag" sortKey="tag" current={sortConfig} onSort={toggleSort} />
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
            <Route index element={<ReportView />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="trends" element={<TrendsView />} />
            <Route path="movers" element={<MoversView />} />
            <Route path="declines" element={<DeclinesView />} />
            <Route path="improvements" element={<ImprovementsView />} />
            <Route path="first-page" element={<FirstPageView />} />
            <Route path="top-3" element={<Top3View />} />
            <Route path="tags" element={<TagsView />} />
          </Route>
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}
