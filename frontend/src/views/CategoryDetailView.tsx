import React, { useMemo, useState } from 'react';
import { useParams, useOutletContext, Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Minus, Search, Download, Layers } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import type { AppContextType } from '../App';
import { KEYWORDS, getTags, getTagTimeline } from '../dataStore';
import { scoreKeyword } from '../metricsEngine';
import type { ScoredKeyword } from '../metricsEngine';
import { SortableHeader, sortByConfig, toggleSortConfig } from '../components/SortableHeader';
import type { SortConfig } from '../components/SortableHeader';
import { downloadCsv } from '../csvUtils';
import { buildKeywordTrendSeries, TREND_LINE_COLORS } from '../components/positionSeries';

export const CategoryDetailView: React.FC = () => {
    const { tag: tagParam } = useParams<{ tag: string }>();
    const { dateFrom, dateTo } = useOutletContext<AppContextType>();
    const tag = decodeURIComponent(tagParam || '');

    const [keywordSearch, setKeywordSearch] = useState('');
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'opportunityScore', dir: 'desc' });
    const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
    const toggleKeywordSelection = (keyword: string) => {
        setSelectedKeywords(prev => {
            const next = new Set(prev);
            if (next.has(keyword)) next.delete(keyword); else next.add(keyword);
            return next;
        });
    };

    const allTagsCount = useMemo(() => getTags().length, []);

    const categoryKeywords: ScoredKeyword[] = useMemo(() => {
        return KEYWORDS
            .filter(k => k.tags.includes(tag))
            .map(k => scoreKeyword(k, dateFrom, dateTo));
    }, [tag, dateFrom, dateTo]);

    const stats = useMemo(() => {
        const totalVolume = categoryKeywords.reduce((sum, k) => sum + k.volume, 0);
        const totalNetChange = categoryKeywords.reduce((sum, k) => sum + k.netChange, 0);
        const withPos = categoryKeywords.filter(k => k.currentPos !== null);
        const avgPosition = withPos.length > 0
            ? (withPos.reduce((sum, k) => sum + (k.currentPos || 0), 0) / withPos.length).toFixed(1)
            : '-';
        const raised = categoryKeywords.filter(k => k.netChange > 0).length;
        const dropped = categoryKeywords.filter(k => k.netChange < 0).length;
        return { totalVolume, totalNetChange, avgPosition, raised, dropped, keywords: categoryKeywords.length };
    }, [categoryKeywords]);

    // Pass a maxTags high enough that this specific category is always
    // included in the returned series, regardless of its volume rank.
    const timelineData = useMemo(() => {
        return getTagTimeline({ date_from: dateFrom, date_to: dateTo, maxTags: Math.max(allTagsCount, 1) });
    }, [dateFrom, dateTo, allTagsCount]);

    const trendData = useMemo(() => {
        return (timelineData.timeline || []).map((row: any) => ({
            date: row.date,
            avgPosition: row[tag] ?? null,
        }));
    }, [timelineData, tag]);

    // Selecting keywords in the table below swaps the category-aggregate
    // trend line for individual rank-history lines per selected keyword.
    const selectedTrendData = useMemo(() => {
        if (selectedKeywords.size === 0) return [];
        return buildKeywordTrendSeries(categoryKeywords.filter(k => selectedKeywords.has(k.keyword)));
    }, [categoryKeywords, selectedKeywords]);

    const filteredKeywords = useMemo(() => {
        if (!keywordSearch) return categoryKeywords;
        const q = keywordSearch.toLowerCase();
        return categoryKeywords.filter(k => k.keyword.toLowerCase().includes(q));
    }, [categoryKeywords, keywordSearch]);

    const toggleSort = (key: string) => setSortConfig(prev => toggleSortConfig(prev, key));

    const sortedKeywords = useMemo(() => {
        return sortByConfig(filteredKeywords, sortConfig, {
            keyword: (k) => k.keyword,
            volume: (k) => k.volume,
            currentPos: (k) => k.currentPos,
            netChange: (k) => k.netChange,
            opportunityScore: (k) => k.opportunityScore,
        });
    }, [filteredKeywords, sortConfig]);

    const handleExportCsv = () => {
        const headers = ['Keyword', 'Volume', 'Current Pos', 'Net Change', 'Opportunity Score'];
        const rows = sortedKeywords.map(k => [
            k.keyword, k.volume, k.currentPos ?? '', k.netChange, k.opportunityScore,
        ]);
        const safeTag = tag.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
        downloadCsv(`category-${safeTag}-keywords-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    };

    return (
        <div className="space-y-6">
            <Link to="/segments" className="inline-flex items-center text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back to Product Segments
            </Link>

            {/* Header */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">{tag}</h2>
                    <p className="text-xs text-gray-500 mt-1">{stats.keywords} keywords tracked in this category.</p>
                </div>
                <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                    <Layers className="w-6 h-6" />
                </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <div className="text-xs font-semibold text-gray-500 uppercase">Keywords</div>
                    <div className="text-2xl font-bold text-gray-900 mt-1">{stats.keywords}</div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <div className="text-xs font-semibold text-gray-500 uppercase">Total Volume</div>
                    <div className="text-2xl font-bold text-indigo-600 mt-1">{stats.totalVolume.toLocaleString()}</div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <div className="text-xs font-semibold text-gray-500 uppercase">Avg Position</div>
                    <div className="text-2xl font-bold text-gray-900 mt-1">{stats.avgPosition}</div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <div className="text-xs font-semibold text-gray-500 uppercase">Net Movement</div>
                    <div className={`text-2xl font-bold mt-1 flex items-center gap-1 ${stats.totalNetChange > 0 ? 'text-emerald-600' : stats.totalNetChange < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {stats.totalNetChange > 0 ? <ArrowUpRight className="w-5 h-5" /> : stats.totalNetChange < 0 ? <ArrowDownRight className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
                        {stats.totalNetChange > 0 ? `+${stats.totalNetChange}` : stats.totalNetChange}
                    </div>
                    <div className="text-[10px] text-gray-400 font-medium mt-1">
                        <span className="text-emerald-600 font-semibold">+{stats.raised}</span> / <span className="text-red-600 font-semibold">-{stats.dropped}</span>
                    </div>
                </div>
            </div>

            {/* Trend chart -- individual keyword rank histories when the table
                below has a selection, otherwise the category-wide average. */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-1">
                    <h3 className="text-base font-semibold text-gray-900">
                        {selectedKeywords.size > 0 ? `Rank Trend -- ${selectedKeywords.size} Selected Keyword${selectedKeywords.size > 1 ? 's' : ''}` : 'Avg Position Trend'}
                    </h3>
                    {selectedKeywords.size > 0 && (
                        <button onClick={() => setSelectedKeywords(new Set())} className="text-xs text-gray-400 hover:text-gray-600 underline">Clear selection</button>
                    )}
                </div>
                <p className="text-xs text-gray-400 mb-4">
                    {selectedKeywords.size > 0
                        ? 'Historical SERP position for each selected keyword. Lower is better.'
                        : 'Average ranking position over time for this category. Lower is better.'}
                </p>
                {selectedKeywords.size > 0 ? (
                    selectedTrendData.length === 0 ? (
                        <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
                            <span className="text-gray-400 font-medium">No position history for the selected keywords</span>
                        </div>
                    ) : (
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={selectedTrendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <YAxis reversed domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 11 }} label={{ value: 'Position', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#9ca3af' } }} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                                    {Array.from(selectedKeywords).map((kw, i) => (
                                        <Line key={kw} type="monotone" dataKey={kw} stroke={TREND_LINE_COLORS[i % TREND_LINE_COLORS.length]} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )
                ) : trendData.length === 0 || trendData.every(r => r.avgPosition === null) ? (
                    <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
                        <span className="text-gray-400 font-medium">No timeline data available</span>
                    </div>
                ) : (
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis reversed domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 11 }} label={{ value: 'Avg Position', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#9ca3af' } }} />
                                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                                <Line type="monotone" dataKey="avgPosition" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, fill: '#4f46e5' }} connectNulls name="Avg Position" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Keyword table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-base font-semibold text-gray-900">Keywords in {tag}</h3>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                            <input
                                type="text"
                                value={keywordSearch}
                                onChange={e => setKeywordSearch(e.target.value)}
                                placeholder="Search keywords..."
                                className="pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                        <span className="text-xs text-gray-500">Showing {sortedKeywords.length} of {categoryKeywords.length}</span>
                        <button
                            onClick={handleExportCsv}
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
                                <th className="px-4 py-4 w-10">
                                    <input
                                        type="checkbox"
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        checked={sortedKeywords.length > 0 && sortedKeywords.every(r => selectedKeywords.has(r.keyword))}
                                        onChange={(e) => {
                                            setSelectedKeywords(prev => {
                                                const next = new Set(prev);
                                                sortedKeywords.forEach(r => e.target.checked ? next.add(r.keyword) : next.delete(r.keyword));
                                                return next;
                                            });
                                        }}
                                    />
                                </th>
                                <SortableHeader label="Keyword" sortKey="keyword" current={sortConfig} onSort={toggleSort} />
                                <SortableHeader label="Volume" sortKey="volume" current={sortConfig} onSort={toggleSort} align="right" />
                                <SortableHeader label="Current Pos" sortKey="currentPos" current={sortConfig} onSort={toggleSort} align="right" />
                                <SortableHeader label="Net Change" sortKey="netChange" current={sortConfig} onSort={toggleSort} align="right" />
                                <SortableHeader label="Opportunity Score" sortKey="opportunityScore" current={sortConfig} onSort={toggleSort} align="right" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white text-sm">
                            {sortedKeywords.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-8 text-center text-sm font-medium text-gray-500">No keywords match your search</td></tr>
                            ) : sortedKeywords.map(row => {
                                const isSelected = selectedKeywords.has(row.keyword);
                                return (
                                    <tr key={row.keyword} className={isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'}>
                                        <td className="px-4 py-3.5">
                                            <input
                                                type="checkbox"
                                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                checked={isSelected}
                                                onChange={() => toggleKeywordSelection(row.keyword)}
                                            />
                                        </td>
                                        <td className="px-6 py-3.5 font-medium text-indigo-600">
                                            <Link to={`/keyword/${encodeURIComponent(row.keyword)}`} className="hover:underline">{row.keyword}</Link>
                                        </td>
                                        <td className="px-6 py-3.5 text-right font-medium text-gray-700">{row.volume.toLocaleString()}</td>
                                        <td className="px-6 py-3.5 text-right font-semibold text-gray-900">{row.currentPos ?? '-'}</td>
                                        <td className="px-6 py-3.5 text-right font-bold">
                                            <span className={row.netChange > 0 ? 'text-emerald-600' : row.netChange < 0 ? 'text-red-600' : 'text-gray-400'}>
                                                {row.netChange > 0 ? `+${row.netChange}` : row.netChange}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3.5 text-right font-bold text-emerald-600">{row.opportunityScore.toLocaleString()}</td>
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
