import React, { useMemo, useState } from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router-dom';
import { Layers, Download, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import type { AppContextType } from '../App';
import { getTagSummary, getTags, getTagTimeline } from '../dataStore';
import { GlobalFilterBar } from '../components/GlobalFilterBar';
import type { FilterState } from '../components/GlobalFilterBar';
import { SortableHeader, sortByConfig } from '../components/SortableHeader';
import type { SortConfig } from '../components/SortableHeader';
import { downloadCsv } from '../csvUtils';
import { CATEGORY_COLORS } from '../components/chartColors';

const DEFAULT_FILTER_STATE: FilterState = {
    keywordSearch: '',
    rankBand: 'all',
    valueTier: 'all',
    categoryTag: 'all',
    preset: 'all',
};

// Rank band boundaries mirrored from metricsEngine.getRankBand, applied here
// against each category's average position rather than a single keyword's.
function avgPosInRankBand(avgPosition: string, band: string): boolean {
    if (avgPosition === '-' || avgPosition === '') return false;
    const pos = parseFloat(avgPosition);
    if (Number.isNaN(pos)) return false;
    if (band === 'Top 3') return pos >= 1 && pos <= 3;
    if (band === 'Pos 4-10') return pos >= 4 && pos <= 10;
    if (band === 'Pos 11-20') return pos >= 11 && pos <= 20;
    if (band === 'Pos 21+') return pos > 20;
    return true;
}

// Volume tier bucketing analogous to metricsEngine.getValueTier, scaled for
// aggregated category totals instead of a single keyword's value score.
function volumeTier(totalVolume: number): 'high' | 'medium' | 'low' {
    if (totalVolume >= 5000) return 'high';
    if (totalVolume >= 500) return 'medium';
    return 'low';
}

export const SegmentsView: React.FC = () => {
    const { dateFrom, dateTo, setDateFrom, setDateTo } = useOutletContext<AppContextType>();
    const navigate = useNavigate();
    const [filterState, setFilterState] = useState<FilterState>(DEFAULT_FILTER_STATE);

    const tags = useMemo(() => getTags().map(t => t.tag), []);

    const tagSummaryData = useMemo(() => {
        const res = getTagSummary({ date_from: dateFrom, date_to: dateTo });
        return res.data || [];
    }, [dateFrom, dateTo]);

    const handleReset = () => setFilterState(DEFAULT_FILTER_STATE);

    // Single filtered dataset feeding both the category chart and the table
    const filteredTags = useMemo(() => {
        let out = tagSummaryData;

        if (filterState.keywordSearch) {
            const q = filterState.keywordSearch.toLowerCase();
            out = out.filter(t => t.tag.toLowerCase().includes(q));
        }

        if (filterState.categoryTag && filterState.categoryTag !== 'all') {
            out = out.filter(t => t.tag === filterState.categoryTag);
        }

        if (filterState.rankBand && filterState.rankBand !== 'all') {
            out = out.filter(t => avgPosInRankBand(t.avgPosition, filterState.rankBand));
        }

        if (filterState.valueTier && filterState.valueTier !== 'all') {
            out = out.filter(t => volumeTier(t.totalVolume) === filterState.valueTier);
        }

        switch (filterState.preset) {
            case 'highest_value_opps':
                out = out.filter(t => t.totalNetChange > 0);
                break;
            case 'near_wins':
            case 'top3_push':
                out = out.filter(t => avgPosInRankBand(t.avgPosition, 'Pos 4-10'));
                break;
            case 'highest_value_declines':
                out = out.filter(t => t.totalNetChange < 0);
                break;
            case 'first_page_drops':
                out = out.filter(t => t.dropped > t.raised);
                break;
            default:
                break; // 'all' -- no preset filtering
        }

        return out;
    }, [tagSummaryData, filterState]);

    // Table sort state -- defaults to the view's previous static sort
    // (Total Search Volume, descending, as returned by getTagSummary) until
    // the user clicks a column header.
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'totalVolume', dir: 'desc' });
    const toggleSort = (key: string) => {
        setSortConfig(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
    };
    const sortedTags = useMemo(() => {
        return sortByConfig(filteredTags, sortConfig, {
            tag: (t) => t.tag,
            keywords: (t) => t.keywords,
            totalVolume: (t) => t.totalVolume,
            avgPosition: (t) => (t.avgPosition === '-' || t.avgPosition === '' ? null : parseFloat(t.avgPosition)),
            totalNetChange: (t) => t.totalNetChange,
            raised: (t) => t.raised,
        });
    }, [filteredTags, sortConfig]);

    const handleExportCsv = () => {
        const headers = ['Product Category Tag', 'Keyword Count', 'Total Search Volume', 'Avg Position', 'Net Movement', 'Gained', 'Lost'];
        const rows = sortedTags.map(row => [
            row.tag,
            row.keywords,
            row.totalVolume,
            row.avgPosition || '',
            row.totalNetChange,
            row.raised,
            row.dropped,
        ]);
        downloadCsv(`segments-categories-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    };

    // Rank-trend line chart -- one line per category currently in view
    // (respecting the active filters), capped to the top 8 by volume for
    // readability. maxTags is passed as the full tag count so getTagTimeline
    // always includes every category's series regardless of its volume rank,
    // and we then just pick which lines to draw from the filtered set.
    const trendTags = useMemo(() => filteredTags.slice(0, 8).map(t => t.tag), [filteredTags]);
    const categoryTimeline = useMemo(() => {
        return getTagTimeline({ date_from: dateFrom, date_to: dateTo, maxTags: Math.max(tags.length, 1) });
    }, [dateFrom, dateTo, tags.length]);
    const categoryTrendData = useMemo(() => {
        return (categoryTimeline.timeline || []).map((row: any) => {
            const out: Record<string, string | number> = { date: row.date };
            trendTags.forEach(tag => { if (row[tag] !== undefined) out[tag] = row[tag]; });
            return out;
        });
    }, [categoryTimeline, trendTags]);

    // Category volume pie -- clicking a slice drills into that category's
    // dedicated report page (keyword-level breakdown + trend).
    const pieData = useMemo(() => {
        return filteredTags.map(t => ({ name: t.tag, value: t.totalVolume }));
    }, [filteredTags]);

    const goToCategory = (tag: string) => navigate(`/segments/${encodeURIComponent(tag)}`);

    // Scorecards ranked so the biggest movers (up or down) surface first --
    // a top-level "what's improving vs declining" signal at a glance.
    const scorecardTags = useMemo(() => {
        return [...filteredTags].sort((a, b) => Math.abs(b.totalNetChange) - Math.abs(a.totalNetChange));
    }, [filteredTags]);

    return (
        <div className="space-y-6">
            <GlobalFilterBar
                dateFrom={dateFrom}
                dateTo={dateTo}
                setDateFrom={setDateFrom}
                setDateTo={setDateTo}
                filterState={filterState}
                setFilterState={setFilterState}
                tags={tags}
                onReset={handleReset}
            />

            {/* Header Banner */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-gray-900">Product Category & Segment Analytics</h2>
                    <p className="text-xs text-gray-500 mt-1">Aggregated search volume, keyword counts, and net ranking movements grouped by category tags.</p>
                </div>
                <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                    <Layers className="w-6 h-6" />
                </div>
            </div>

            {/* Category Scorecards -- top-level improving vs. declining signal */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold text-gray-900">Category Health Scorecards</h3>
                    <span className="text-xs text-gray-400">Sorted by magnitude of movement -- biggest signals first</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {scorecardTags.map(t => {
                        const isUp = t.totalNetChange > 0;
                        const isDown = t.totalNetChange < 0;
                        return (
                            <button
                                key={t.tag}
                                onClick={() => goToCategory(t.tag)}
                                className={`text-left bg-white rounded-xl p-4 shadow-sm border transition-all hover:shadow-md ${isUp ? 'border-emerald-100 hover:border-emerald-300' : isDown ? 'border-red-100 hover:border-red-300' : 'border-gray-100 hover:border-indigo-200'
                                    }`}
                            >
                                <div className="text-sm font-bold text-gray-900 truncate" title={t.tag}>{t.tag}</div>
                                <div className="flex items-center justify-between mt-3">
                                    <div>
                                        <div className="text-lg font-bold text-gray-900">{t.totalVolume.toLocaleString()}</div>
                                        <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Volume</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-gray-900">{t.avgPosition || '-'}</div>
                                        <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Avg Pos</div>
                                    </div>
                                </div>
                                <div className={`mt-3 inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${isUp ? 'bg-emerald-50 text-emerald-600' : isDown ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-400'
                                    }`}>
                                    {isUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : isDown ? <ArrowDownRight className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                                    {t.totalNetChange > 0 ? `+${t.totalNetChange}` : t.totalNetChange}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Category Search Volume & Keyword Breakdown Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
                    <h3 className="text-base font-semibold text-gray-900 mb-1">Category Rank Trend</h3>
                    <p className="text-xs text-gray-400 mb-4">Avg position over time for the top {trendTags.length} categories currently in view (respects active filters). Lower is better.</p>
                    {categoryTrendData.length === 0 || trendTags.length === 0 ? (
                        <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
                            <span className="text-gray-400 font-medium">No timeline data available</span>
                        </div>
                    ) : (
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={categoryTrendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <YAxis reversed domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 11 }} label={{ value: 'Avg Position', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#9ca3af' } }} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px', fontSize: '11px' }} />
                                    {trendTags.map((tag, i) => (
                                        <Line key={tag} type="monotone" dataKey={tag} stroke={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} strokeWidth={2} dot={{ r: 2 }} connectNulls />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-base font-semibold text-gray-900 mb-1">Volume by Category</h3>
                    <p className="text-xs text-gray-400 mb-4">Click a slice to open that category's report.</p>
                    <div className="h-64 w-full">
                        {pieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                                    <Pie
                                        data={pieData}
                                        cx="50%" cy="50%"
                                        innerRadius={40} outerRadius={80}
                                        dataKey="value"
                                        stroke="#ffffff"
                                        strokeWidth={2}
                                        onClick={(_: any, index: number) => {
                                            const name = pieData[index]?.name;
                                            if (name) goToCategory(name);
                                        }}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {pieData.map((entry, i) => (
                                            <Cell key={`cell-${entry.name}`} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: any) => new Intl.NumberFormat('en-US').format(Number(value) || 0)} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400 text-sm">No data</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Category Segment Details Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900">All Product Categories</h3>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">Showing {filteredTags.length} of {tagSummaryData.length} categories</span>
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
                                <SortableHeader label="Product Category Tag" sortKey="tag" current={sortConfig} onSort={toggleSort} />
                                <SortableHeader label="Keyword Count" sortKey="keywords" current={sortConfig} onSort={toggleSort} align="right" />
                                <SortableHeader label="Total Search Volume" sortKey="totalVolume" current={sortConfig} onSort={toggleSort} align="right" />
                                <SortableHeader label="Avg Position" sortKey="avgPosition" current={sortConfig} onSort={toggleSort} align="right" />
                                <SortableHeader label="Net Movement" sortKey="totalNetChange" current={sortConfig} onSort={toggleSort} align="right" />
                                <SortableHeader label="Gained / Lost" sortKey="raised" current={sortConfig} onSort={toggleSort} align="right" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white text-sm">
                            {sortedTags.map((row) => (
                                <tr key={row.tag} className="hover:bg-gray-50">
                                    <td className="px-6 py-3.5 font-bold text-gray-900">
                                        <Link to={`/segments/${encodeURIComponent(row.tag)}`} className="text-indigo-600 hover:underline">{row.tag}</Link>
                                    </td>
                                    <td className="px-6 py-3.5 text-right font-medium text-gray-700">{row.keywords}</td>
                                    <td className="px-6 py-3.5 text-right font-bold text-indigo-600">{row.totalVolume.toLocaleString()}</td>
                                    <td className="px-6 py-3.5 text-right font-medium text-gray-700">{row.avgPosition || '-'}</td>
                                    <td className="px-6 py-3.5 text-right font-bold">
                                        <span className={row.totalNetChange > 0 ? 'text-emerald-600' : row.totalNetChange < 0 ? 'text-red-600' : 'text-gray-400'}>
                                            {row.totalNetChange > 0 ? `+${row.totalNetChange}` : row.totalNetChange}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3.5 text-right text-xs">
                                        <span className="text-emerald-600 font-semibold">+{row.raised}</span> / <span className="text-red-600 font-semibold">-{row.dropped}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
