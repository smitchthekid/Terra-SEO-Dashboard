import React, { useState, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getSeoReport } from './dataStore';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
    PieChart, Pie, Sector,
} from 'recharts';
import { Search, ArrowUpDown, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

type AppContextType = {
    dateFrom: string;
    dateTo: string;
    setDateFrom: (d: string) => void;
    setDateTo: (d: string) => void;
};

// ---------------------------------------------------------------------------
// Sortable Table Header
// ---------------------------------------------------------------------------

type SortConfig = { key: string; dir: 'asc' | 'desc' };

function SortableHeader({
    label, sortKey, current, onSort, align = 'left',
}: {
    label: string; sortKey: string; current: SortConfig; onSort: (key: string) => void; align?: 'left' | 'right';
}) {
    const isActive = current.key === sortKey;
    return (
        <th
            className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100 transition-colors ${align === 'right' ? 'text-right' : 'text-left'}`}
            onClick={() => onSort(sortKey)}
        >
            <span className="inline-flex items-center gap-1">
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
// Utility: format numbers
// ---------------------------------------------------------------------------

function fmtNum(n: number | null | undefined, decimals = 0): string {
    if (n === null || n === undefined) return '-';
    if (Math.abs(n) >= 1000) {
        return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
    }
    return n.toFixed(decimals);
}

function fmtDelta(n: number | null | undefined, decimals = 0): string {
    if (n === null || n === undefined) return '-';
    const prefix = n > 0 ? '+' : '';
    return prefix + fmtNum(n, decimals);
}

// ---------------------------------------------------------------------------
// Active Pie Sector Renderer
// ---------------------------------------------------------------------------

const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
    return (
        <g>
            <text x={cx} y={cy - 10} textAnchor="middle" fill="#374151" fontSize={13} fontWeight={600}>
                {payload.name}
            </text>
            <text x={cx} y={cy + 12} textAnchor="middle" fill="#6b7280" fontSize={11}>
                {fmtNum(value)} ({(percent * 100).toFixed(1)}%)
            </text>
            <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 8} startAngle={startAngle} endAngle={endAngle} fill={fill} />
            <Sector cx={cx} cy={cy} innerRadius={outerRadius + 12} outerRadius={outerRadius + 16} startAngle={startAngle} endAngle={endAngle} fill={fill} />
        </g>
    );
};

// ---------------------------------------------------------------------------
// Report View Component
// ---------------------------------------------------------------------------

export default function ReportView() {
    const { } = useOutletContext<AppContextType>();

    // Filters
    const [queryContains, setQueryContains] = useState('');
    const [urlContains, setUrlContains] = useState('');
    const [avgPosMax, setAvgPosMax] = useState('200');
    const [activeTab, setActiveTab] = useState<'trends' | 'declines' | 'gains' | 'combined' | 'categories'>('trends');

    // Sort states per table
    const [trendsSort, setTrendsSort] = useState<SortConfig>({ key: 'click_delta', dir: 'desc' });
    const [declinesSort, setDeclinesSort] = useState<SortConfig>({ key: 'click_delta', dir: 'asc' });
    const [gainsSort, setGainsSort] = useState<SortConfig>({ key: 'click_delta', dir: 'desc' });
    const [combinedSort, setCombinedSort] = useState<SortConfig>({ key: 'click_delta', dir: 'desc' });
    const [categoriesSort, setCategoriesSort] = useState<SortConfig>({ key: 'clicks_delta_3mo', dir: 'desc' });

    // Pie chart filter state
    const [activeTrendPie, setActiveTrendPie] = useState<number>(0);
    const [activeMovementPie, setActiveMovementPie] = useState<number>(0);
    const [selectedTrendBucket, setSelectedTrendBucket] = useState<string | null>(null);
    const [selectedMovement, setSelectedMovement] = useState<string | null>(null);

    const { data: reportData, isLoading } = useQuery({
        queryKey: ['seo-report', queryContains, urlContains, avgPosMax],
        queryFn: async () => {
            return getSeoReport({ queryContains, urlContains, avg_position_max: avgPosMax });
        },
        staleTime: 30000,
    });

    // Sort helper
    const sortData = useCallback(<T extends Record<string, any>>(data: T[], sort: SortConfig): T[] => {
        return [...data].sort((a, b) => {
            const av = a[sort.key] ?? 0;
            const bv = b[sort.key] ?? 0;
            const cmp = typeof av === 'string' ? av.localeCompare(bv) : (av as number) - (bv as number);
            return sort.dir === 'asc' ? cmp : -cmp;
        });
    }, []);

    const toggleSort = (setter: React.Dispatch<React.SetStateAction<SortConfig>>) => (key: string) => {
        setter(prev => ({
            key,
            dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc',
        }));
    };

    // Metrics
    const top = (reportData?.topMetrics || {}) as any;
    const trends = useMemo(() => sortData(reportData?.trends || [], trendsSort), [reportData, trendsSort, sortData]);

    const clickDeclines = useMemo(() => {
        return sortData(reportData?.clickDeclines || [], declinesSort);
    }, [reportData, declinesSort, sortData]);

    const clickGains = useMemo(() => {
        return sortData(reportData?.clickGains || [], gainsSort);
    }, [reportData, gainsSort, sortData]);

    const queryUrlCombined = useMemo(() => {
        return sortData(reportData?.queryUrlCombined || [], combinedSort);
    }, [reportData, combinedSort, sortData]);

    const categoryTrends = useMemo(() => {
        return sortData(reportData?.categoryTrends || [], categoriesSort);
    }, [reportData, categoriesSort, sortData]);

    // Pie chart data
    const trendPieData = useMemo(() => {
        return (reportData?.trends || [])
            .filter((t: any) => t.count > 0)
            .map((t: any) => ({ name: t.trend, value: t.count }));
    }, [reportData]);

    const movementPieData = useMemo(() => {
        return (reportData?.rankTrendsVisual || [])
            .filter((t: any) => t.count > 0)
            .map((t: any) => ({ name: t.category, value: t.count }));
    }, [reportData]);

    const TREND_COLORS: Record<string, string> = {
        'Big Gain': '#059669', 'Small Gain': '#34d399',
        'Stable': '#9ca3af',
        'Small Loss': '#fb923c', 'Moderate Loss': '#ef4444', 'Big Loss': '#991b1b',
    };
    const MOVEMENT_COLORS: Record<string, string> = {
        'Gained First Page': '#059669', 'Lost First Page': '#dc2626',
        'Gained Rank': '#34d399', 'Lost Rank': '#f87171', 'No Change': '#9ca3af',
    };

    // Bar chart for rank trends visual
    const rankTrendsBarData = useMemo(() => {
        return (reportData?.rankTrendsVisual || []).map((r: any) => ({
            category: r.category,
            clicks_delta: r.clicks_delta,
        }));
    }, [reportData]);

    const tabs = [
        { key: 'trends', label: 'Trends' },
        { key: 'declines', label: `Declines (${reportData?.clickDeclines?.length || 0})` },
        { key: 'gains', label: `Gains (${reportData?.clickGains?.length || 0})` },
        { key: 'combined', label: 'Query x URL' },
        { key: 'categories', label: 'Categories' },
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">Computing 90-day SEO report...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Title */}
            <div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">90-Day SEO Performance Report</h2>
                <p className="text-sm text-gray-500 mt-1">
                    Comparing last 3 months vs. previous 3 months | Filtered to queries with rank data within last 30 days
                    {top.total_records !== undefined && <span className="ml-2 font-medium text-indigo-600">({top.total_records} queries)</span>}
                </p>
            </div>

            {/* Global Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[180px]">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                            <Search className="inline w-3.5 h-3.5 mr-1" />Query Contains
                        </label>
                        <input
                            type="text"
                            value={queryContains}
                            onChange={e => setQueryContains(e.target.value)}
                            placeholder="e.g. clean room, hepa..."
                            className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    <div className="flex-1 min-w-[180px]">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                            <Search className="inline w-3.5 h-3.5 mr-1" />URL Contains
                        </label>
                        <input
                            type="text"
                            value={urlContains}
                            onChange={e => setUrlContains(e.target.value)}
                            placeholder="e.g. /blog/, terrauniversal..."
                            className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    <div className="w-32">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Max Avg Pos</label>
                        <input
                            type="number"
                            value={avgPosMax}
                            onChange={e => setAvgPosMax(e.target.value)}
                            className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                </div>
            </div>

            {/* Top KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <KpiCard label="Click Delta" value={fmtDelta(top.click_delta)} color={top.click_delta >= 0 ? 'emerald' : 'red'} sub="Est. click change" />
                <KpiCard label="Clicks (Last 3mo)" value={fmtNum(top.clicks_last_3mo)} color="blue" sub="CTR-estimated" />
                <KpiCard label="Clicks (Prev 3mo)" value={fmtNum(top.clicks_prev_3mo)} color="slate" sub="CTR-estimated" />
                <KpiCard label="Rank Delta" value={fmtDelta(top.rank_delta, 2)} color={top.rank_delta <= 0 ? 'emerald' : 'red'} sub="Avg rank change" />
                <KpiCard label="Avg Rank Was" value={fmtNum(top.avg_rank_was, 1)} color="slate" sub="Previous period" />
                <KpiCard label="Avg Rank Now" value={fmtNum(top.avg_rank_now, 1)} color="indigo" sub="Current period" />
            </div>

            {/* Dashboard Pie Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Trend Distribution Pie */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <h3 className="text-base font-semibold text-gray-900 mb-1">Trend Distribution</h3>
                    <p className="text-xs text-gray-400 mb-3">Click a segment to filter tables below</p>
                    {trendPieData.length > 0 ? (
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        {...{ activeIndex: activeTrendPie } as any}
                                        activeShape={renderActiveShape}
                                        data={trendPieData}
                                        cx="50%" cy="50%"
                                        innerRadius={55} outerRadius={85}
                                        dataKey="value"
                                        onMouseEnter={(_: any, index: number) => setActiveTrendPie(index)}
                                        onClick={(_: any, index: number) => {
                                            const name = trendPieData[index]?.name;
                                            setSelectedTrendBucket(prev => prev === name ? null : name);
                                        }}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {trendPieData.map((entry: any, i: number) => (
                                            <Cell
                                                key={i}
                                                fill={TREND_COLORS[entry.name] || '#6b7280'}
                                                opacity={selectedTrendBucket && selectedTrendBucket !== entry.name ? 0.3 : 1}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No data</div>
                    )}
                    {selectedTrendBucket && (
                        <div className="mt-2 flex items-center gap-2">
                            <span className="text-xs text-gray-500">Filtering by:</span>
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">{selectedTrendBucket}</span>
                            <button onClick={() => setSelectedTrendBucket(null)} className="text-xs text-gray-400 hover:text-gray-600 underline">Clear</button>
                        </div>
                    )}
                </div>

                {/* Rank Movement Pie */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <h3 className="text-base font-semibold text-gray-900 mb-1">Rank Movement</h3>
                    <p className="text-xs text-gray-400 mb-3">Click a segment to filter tables below</p>
                    {movementPieData.length > 0 ? (
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        {...{ activeIndex: activeMovementPie } as any}
                                        activeShape={renderActiveShape}
                                        data={movementPieData}
                                        cx="50%" cy="50%"
                                        innerRadius={55} outerRadius={85}
                                        dataKey="value"
                                        onMouseEnter={(_: any, index: number) => setActiveMovementPie(index)}
                                        onClick={(_: any, index: number) => {
                                            const name = movementPieData[index]?.name;
                                            setSelectedMovement(prev => prev === name ? null : name);
                                        }}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {movementPieData.map((entry: any, i: number) => (
                                            <Cell
                                                key={i}
                                                fill={MOVEMENT_COLORS[entry.name] || '#6b7280'}
                                                opacity={selectedMovement && selectedMovement !== entry.name ? 0.3 : 1}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No data</div>
                    )}
                    {selectedMovement && (
                        <div className="mt-2 flex items-center gap-2">
                            <span className="text-xs text-gray-500">Filtering by:</span>
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">{selectedMovement}</span>
                            <button onClick={() => setSelectedMovement(null)} className="text-xs text-gray-400 hover:text-gray-600 underline">Clear</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Rank Trends by Total Clicks Gained/Lost */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h3 className="text-base font-semibold text-gray-900 mb-4">Rank Trends by Total Est. Clicks Gained/Lost</h3>
                {rankTrendsBarData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={rankTrendsBarData} layout="vertical" margin={{ top: 5, right: 30, left: 120, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                            <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                            <YAxis type="category" dataKey="category" tick={{ fontSize: 12, fill: '#374151' }} width={120} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                            <Bar dataKey="clicks_delta" name="Est. Clicks Delta" radius={[0, 4, 4, 0]}>
                                {rankTrendsBarData.map((entry: any, i: number) => (
                                    <Cell key={i} fill={entry.clicks_delta >= 0 ? '#10b981' : '#ef4444'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-64 flex items-center justify-center text-gray-400 text-sm">No rank movement data</div>
                )}
            </div>

            {/* Table Tabs */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="border-b border-gray-200 flex items-center justify-between px-4">
                    <div className="flex gap-0 overflow-x-auto whitespace-nowrap hide-scrollbar">
                        {tabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key as any)}
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key
                                    ? 'border-indigo-600 text-indigo-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                        <Search className="w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={queryContains}
                            onChange={e => setQueryContains(e.target.value)}
                            placeholder="Connected search..."
                            className="text-sm border-0 border-b border-gray-200 focus:ring-0 focus:border-indigo-500 py-1 w-48 bg-transparent"
                        />
                    </div>
                </div>

                {/* Trends Table */}
                {activeTab === 'trends' && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-left">
                            <thead className="bg-gray-50">
                                <tr>
                                    <SortableHeader label="Trend" sortKey="trend" current={trendsSort} onSort={toggleSort(setTrendsSort)} />
                                    <SortableHeader label="Click Delta" sortKey="click_delta" current={trendsSort} onSort={toggleSort(setTrendsSort)} align="right" />
                                    <SortableHeader label="Rank Now" sortKey="rank_now" current={trendsSort} onSort={toggleSort(setTrendsSort)} align="right" />
                                    <SortableHeader label="Rank Was" sortKey="rank_was" current={trendsSort} onSort={toggleSort(setTrendsSort)} align="right" />
                                    <SortableHeader label="Count" sortKey="count" current={trendsSort} onSort={toggleSort(setTrendsSort)} align="right" />
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {trends.map((row: any, i: number) => {
                                    const isSelected = row.trend === selectedTrendBucket;
                                    return (
                                        <tr
                                            key={i}
                                            onClick={() => setSelectedTrendBucket(isSelected ? null : row.trend)}
                                            className={`cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50 hover:bg-indigo-100' : 'hover:bg-gray-50'}`}
                                        >
                                            <td className="px-4 py-3 text-sm">
                                                <span className="inline-flex items-center gap-1.5">
                                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TREND_COLORS[row.trend] || '#9ca3af' }} />
                                                    <span className="font-semibold text-gray-900">{row.trend}</span>
                                                </span>
                                            </td>
                                            <td className={`px-4 py-3 text-sm font-bold text-right ${row.click_delta > 0 ? 'text-emerald-600' : row.click_delta < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                                {fmtDelta(row.click_delta)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-700 font-medium text-right">{fmtNum(row.rank_now, 1)}</td>
                                            <td className="px-4 py-3 text-sm text-gray-700 font-medium text-right">{fmtNum(row.rank_was, 1)}</td>
                                            <td className="px-4 py-3 text-sm text-gray-700 font-bold text-right">{row.count}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Click Declines Table */}
                {activeTab === 'declines' && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-left">
                            <thead className="bg-gray-50">
                                <tr>
                                    <SortableHeader label="Query" sortKey="query" current={declinesSort} onSort={toggleSort(setDeclinesSort)} />
                                    <SortableHeader label="Click Delta" sortKey="click_delta" current={declinesSort} onSort={toggleSort(setDeclinesSort)} align="right" />
                                    <SortableHeader label="Impress. Delta" sortKey="impressions_delta" current={declinesSort} onSort={toggleSort(setDeclinesSort)} align="right" />
                                    <SortableHeader label="Rank Delta" sortKey="rank_delta" current={declinesSort} onSort={toggleSort(setDeclinesSort)} align="right" />
                                    <SortableHeader label="Rank Was" sortKey="rank_was" current={declinesSort} onSort={toggleSort(setDeclinesSort)} align="right" />
                                    <SortableHeader label="Rank Now" sortKey="rank_now" current={declinesSort} onSort={toggleSort(setDeclinesSort)} align="right" />
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {clickDeclines.slice(0, 100).map((row: any, i: number) => {
                                    const isSelected = row.query === queryContains;
                                    return (
                                        <tr
                                            key={i}
                                            onClick={() => setQueryContains(row.query === queryContains ? '' : row.query)}
                                            className={`cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50 hover:bg-indigo-100' : 'hover:bg-gray-50'}`}
                                        >
                                            <td className="px-4 py-3 text-sm font-semibold text-gray-900 max-w-[300px] truncate" title={row.query}>{row.query}</td>
                                            <td className="px-4 py-3 text-sm font-bold text-red-600 text-right">{fmtDelta(row.click_delta)}</td>
                                            <td className="px-4 py-3 text-sm text-gray-700 text-right">{fmtDelta(row.impressions_delta)}</td>
                                            <td className={`px-4 py-3 text-sm font-medium text-right ${row.rank_delta > 0 ? 'text-red-600' : row.rank_delta < 0 ? 'text-emerald-600' : 'text-gray-500'}`}>
                                                {fmtDelta(row.rank_delta, 1)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-700 text-right">{fmtNum(row.rank_was, 1)}</td>
                                            <td className="px-4 py-3 text-sm text-gray-700 text-right">{fmtNum(row.rank_now, 1)}</td>
                                        </tr>
                                    );
                                })}
                                {/* Grand Total */}
                                {reportData?.declinesTotal && (
                                    <tr className="bg-gray-50 font-bold border-t-2 border-gray-300">
                                        <td className="px-4 py-3 text-sm text-gray-900">Grand Total ({reportData.declinesTotal.count})</td>
                                        <td className="px-4 py-3 text-sm text-red-700 text-right">{fmtDelta(reportData.declinesTotal.click_delta)}</td>
                                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{fmtDelta(reportData.declinesTotal.impressions_delta)}</td>
                                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{fmtDelta(reportData.declinesTotal.rank_delta, 2)}</td>
                                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{fmtNum(reportData.declinesTotal.rank_was, 1)}</td>
                                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{fmtNum(reportData.declinesTotal.rank_now, 1)}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Click Gains Table */}
                {activeTab === 'gains' && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-left">
                            <thead className="bg-gray-50">
                                <tr>
                                    <SortableHeader label="Query" sortKey="query" current={gainsSort} onSort={toggleSort(setGainsSort)} />
                                    <SortableHeader label="Click Delta" sortKey="click_delta" current={gainsSort} onSort={toggleSort(setGainsSort)} align="right" />
                                    <SortableHeader label="Pos. Gained" sortKey="positions_gained" current={gainsSort} onSort={toggleSort(setGainsSort)} align="right" />
                                    <SortableHeader label="Impress. Delta" sortKey="impressions_delta" current={gainsSort} onSort={toggleSort(setGainsSort)} align="right" />
                                    <SortableHeader label="Rank Was" sortKey="rank_was" current={gainsSort} onSort={toggleSort(setGainsSort)} align="right" />
                                    <SortableHeader label="Rank Now" sortKey="rank_now" current={gainsSort} onSort={toggleSort(setGainsSort)} align="right" />
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {clickGains.slice(0, 100).map((row: any, i: number) => {
                                    const isSelected = row.query === queryContains;
                                    return (
                                        <tr
                                            key={i}
                                            onClick={() => setQueryContains(row.query === queryContains ? '' : row.query)}
                                            className={`cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50 hover:bg-indigo-100' : 'hover:bg-gray-50'}`}
                                        >
                                            <td className="px-4 py-3 text-sm font-semibold text-gray-900 max-w-[300px] truncate" title={row.query}>{row.query}</td>
                                            <td className="px-4 py-3 text-sm font-bold text-emerald-600 text-right">{fmtDelta(row.click_delta)}</td>
                                            <td className="px-4 py-3 text-sm font-medium text-emerald-600 text-right">{fmtDelta(row.positions_gained, 1)}</td>
                                            <td className="px-4 py-3 text-sm text-gray-700 text-right">{fmtDelta(row.impressions_delta)}</td>
                                            <td className="px-4 py-3 text-sm text-gray-700 text-right">{fmtNum(row.rank_was, 1)}</td>
                                            <td className="px-4 py-3 text-sm text-gray-700 text-right">{fmtNum(row.rank_now, 1)}</td>
                                        </tr>
                                    );
                                })}
                                {/* Grand Total */}
                                {reportData?.gainsTotal && (
                                    <tr className="bg-gray-50 font-bold border-t-2 border-gray-300">
                                        <td className="px-4 py-3 text-sm text-gray-900">Grand Total ({reportData.gainsTotal.count})</td>
                                        <td className="px-4 py-3 text-sm text-emerald-700 text-right">{fmtDelta(reportData.gainsTotal.click_delta)}</td>
                                        <td className="px-4 py-3 text-sm text-emerald-700 text-right">{fmtDelta(reportData.gainsTotal.positions_gained, 2)}</td>
                                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{fmtDelta(reportData.gainsTotal.impressions_delta)}</td>
                                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{fmtNum(reportData.gainsTotal.rank_was, 1)}</td>
                                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{fmtNum(reportData.gainsTotal.rank_now, 1)}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Query x URL Combined Table */}
                {activeTab === 'combined' && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-left">
                            <thead className="bg-gray-50">
                                <tr>
                                    <SortableHeader label="URL" sortKey="canonical_url" current={combinedSort} onSort={toggleSort(setCombinedSort)} />
                                    <SortableHeader label="Query" sortKey="query" current={combinedSort} onSort={toggleSort(setCombinedSort)} />
                                    <SortableHeader label="Click Delta" sortKey="click_delta" current={combinedSort} onSort={toggleSort(setCombinedSort)} align="right" />
                                    <SortableHeader label="Impress. Delta" sortKey="impressions_delta" current={combinedSort} onSort={toggleSort(setCombinedSort)} align="right" />
                                    <SortableHeader label="Rank Delta" sortKey="rank_delta" current={combinedSort} onSort={toggleSort(setCombinedSort)} align="right" />
                                    <SortableHeader label="Rank Was" sortKey="rank_was" current={combinedSort} onSort={toggleSort(setCombinedSort)} align="right" />
                                    <SortableHeader label="Rank Now" sortKey="rank_now" current={combinedSort} onSort={toggleSort(setCombinedSort)} align="right" />
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {queryUrlCombined.slice(0, 100).map((row: any, i: number) => {
                                    const isSelected = row.query === queryContains;
                                    return (
                                        <tr
                                            key={i}
                                            onClick={(e) => {
                                                if ((e.target as HTMLElement).closest('a')) return;
                                                setQueryContains(row.query === queryContains ? '' : row.query);
                                            }}
                                            className={`cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50 hover:bg-indigo-100' : 'hover:bg-gray-50'}`}
                                        >
                                            <td className="px-4 py-3 text-sm text-indigo-600 max-w-[240px] truncate" title={row.canonical_url}>
                                                {row.canonical_url ? (
                                                    <a href={row.canonical_url} target="_blank" rel="noopener noreferrer" className="hover:underline inline-flex items-center gap-1">
                                                        {new URL(row.canonical_url).pathname.slice(0, 40)}
                                                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                                    </a>
                                                ) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-semibold text-gray-900 max-w-[200px] truncate" title={row.query}>{row.query}</td>
                                            <td className={`px-4 py-3 text-sm font-bold text-right ${row.click_delta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {fmtDelta(row.click_delta)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-700 text-right">{fmtDelta(row.impressions_delta)}</td>
                                            <td className={`px-4 py-3 text-sm font-medium text-right ${row.rank_delta > 0 ? 'text-red-600' : row.rank_delta < 0 ? 'text-emerald-600' : 'text-gray-500'}`}>
                                                {fmtDelta(row.rank_delta, 1)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-700 text-right">{fmtNum(row.rank_was, 1)}</td>
                                            <td className="px-4 py-3 text-sm text-gray-700 text-right">{fmtNum(row.rank_now, 1)}</td>
                                        </tr>
                                    );
                                })}
                                {/* Grand Total */}
                                {reportData?.combinedTotal && (
                                    <tr className="bg-gray-50 font-bold border-t-2 border-gray-300">
                                        <td className="px-4 py-3 text-sm text-gray-900" colSpan={2}>Grand Total ({reportData.combinedTotal.count})</td>
                                        <td className="px-4 py-3 text-sm text-gray-900 text-right">{fmtDelta(reportData.combinedTotal.click_delta)}</td>
                                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{fmtDelta(reportData.combinedTotal.impressions_delta)}</td>
                                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{fmtDelta(reportData.combinedTotal.rank_delta, 2)}</td>
                                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{fmtNum(reportData.combinedTotal.rank_was, 1)}</td>
                                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{fmtNum(reportData.combinedTotal.rank_now, 1)}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Category Trends Table */}
                {activeTab === 'categories' && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-left">
                            <thead className="bg-gray-50">
                                <tr>
                                    <SortableHeader label="Category" sortKey="query_category" current={categoriesSort} onSort={toggleSort(setCategoriesSort)} />
                                    <SortableHeader label="Click Delta" sortKey="clicks_delta_3mo" current={categoriesSort} onSort={toggleSort(setCategoriesSort)} align="right" />
                                    <SortableHeader label="Rank Now" sortKey="rank_last_3mo" current={categoriesSort} onSort={toggleSort(setCategoriesSort)} align="right" />
                                    <SortableHeader label="Rank Was" sortKey="rank_prev_3mo" current={categoriesSort} onSort={toggleSort(setCategoriesSort)} align="right" />
                                    <SortableHeader label="Count" sortKey="count" current={categoriesSort} onSort={toggleSort(setCategoriesSort)} align="right" />
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {categoryTrends.map((row: any, i: number) => {
                                    const isSelected = row.query_category === queryContains;
                                    return (
                                        <tr
                                            key={i}
                                            onClick={() => setQueryContains(row.query_category === queryContains ? '' : row.query_category)}
                                            className={`cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50 hover:bg-indigo-100' : 'hover:bg-gray-50'}`}
                                        >
                                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">{row.query_category}</td>
                                            <td className={`px-4 py-3 text-sm font-bold text-right ${row.clicks_delta_3mo > 0 ? 'text-emerald-600' : row.clicks_delta_3mo < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                                {fmtDelta(row.clicks_delta_3mo)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-700 font-medium text-right">{fmtNum(row.rank_last_3mo, 1)}</td>
                                            <td className="px-4 py-3 text-sm text-gray-700 font-medium text-right">{fmtNum(row.rank_prev_3mo, 1)}</td>
                                            <td className="px-4 py-3 text-sm text-gray-700 font-bold text-right">{row.count}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// KPI Card Component
// ---------------------------------------------------------------------------

function KpiCard({ label, value, color, sub }: { label: string; value: string; color: string; sub: string }) {
    const colorMap: Record<string, string> = {
        emerald: 'border-emerald-200 text-emerald-700',
        red: 'border-red-200 text-red-700',
        blue: 'border-blue-200 text-blue-700',
        indigo: 'border-indigo-200 text-indigo-700',
        slate: 'border-gray-200 text-gray-700',
    };
    const valueColor: Record<string, string> = {
        emerald: 'text-emerald-600',
        red: 'text-red-600',
        blue: 'text-blue-600',
        indigo: 'text-indigo-600',
        slate: 'text-gray-600',
    };

    return (
        <div className={`bg-white rounded-xl shadow-sm border p-4 ${colorMap[color] || 'border-gray-200'}`}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${valueColor[color] || 'text-gray-800'}`}>{value}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
        </div>
    );
}
