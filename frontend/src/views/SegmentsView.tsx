import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Layers, Download } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import type { AppContextType } from '../App';
import { getTagSummary, getTags } from '../dataStore';
import { GlobalFilterBar } from '../components/GlobalFilterBar';
import type { FilterState } from '../components/GlobalFilterBar';
import { SortableHeader, sortByConfig } from '../components/SortableHeader';
import type { SortConfig } from '../components/SortableHeader';
import { downloadCsv } from '../csvUtils';

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

    const barChartData = useMemo(() => {
        return filteredTags.slice(0, 10).map(t => ({
            tag: t.tag.length > 15 ? t.tag.slice(0, 15) + '...' : t.tag,
            totalVolume: t.totalVolume,
            keywords: t.keywords,
            netChange: t.totalNetChange,
        }));
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

            {/* Category Search Volume & Keyword Breakdown Chart */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-base font-semibold text-gray-900 mb-1">Top Product Categories by Volume</h3>
                <p className="text-xs text-gray-400 mb-4">Total search volume footprint across top product lines.</p>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={barChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="tag" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                            <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '11px' }} />
                            <Bar yAxisId="left" dataKey="totalVolume" fill="#044a63" radius={[4, 4, 0, 0]} name="Total Search Volume" />
                            <Bar yAxisId="right" dataKey="keywords" fill="#ad4385" radius={[4, 4, 0, 0]} name="Keyword Count" />
                        </BarChart>
                    </ResponsiveContainer>
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
                                    <td className="px-6 py-3.5 font-bold text-gray-900">{row.tag}</td>
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
