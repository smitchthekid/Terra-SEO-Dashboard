import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AlertTriangle, ArrowDownRight, ShieldAlert, Download } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import type { AppContextType } from '../App';
import { KEYWORDS, getTags } from '../dataStore';
import { scoreKeyword, applyGlobalFilters } from '../metricsEngine';
import type { ScoredKeyword } from '../metricsEngine';
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

export const LossesView: React.FC = () => {
    const { dateFrom, dateTo, setDateFrom, setDateTo } = useOutletContext<AppContextType>();
    const [filterState, setFilterState] = useState<FilterState>(DEFAULT_FILTER_STATE);

    const tags = useMemo(() => getTags().map(t => t.tag), []);

    const allScoredKeywords: ScoredKeyword[] = useMemo(() => {
        return KEYWORDS.map(k => scoreKeyword(k, dateFrom, dateTo));
    }, [dateFrom, dateTo]);

    // Single filtered dataset feeding both the risk chart and the table
    const scoredKeywords: ScoredKeyword[] = useMemo(() => {
        return applyGlobalFilters(allScoredKeywords, filterState);
    }, [allScoredKeywords, filterState]);

    const handleReset = () => setFilterState(DEFAULT_FILTER_STATE);

    // Declines list -- kept sorted by Risk Score (desc) since the chart below
    // (Highest At-Risk Declines) always shows the top risk-ranked items
    // regardless of how the user has the table sorted.
    const decliningKeywords = useMemo(() => {
        return scoredKeywords
            .filter(k => k.netChange < 0)
            .sort((a, b) => b.riskScore - a.riskScore);
    }, [scoredKeywords]);

    // Table sort state -- defaults to the view's previous static sort
    // (Risk Score, descending) until the user clicks a column header.
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'riskScore', dir: 'desc' });
    const toggleSort = (key: string) => {
        setSortConfig(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
    };
    const sortedDecliningKeywords = useMemo(() => {
        return sortByConfig(decliningKeywords, sortConfig, {
            keyword: (k) => k.keyword,
            volume: (k) => k.volume,
            previousPos: (k) => k.previousPos,
            currentPos: (k) => k.currentPos,
            netChange: (k) => k.netChange,
            riskScore: (k) => k.riskScore,
        });
    }, [decliningKeywords, sortConfig]);

    // Loss Severity Groups
    const top3Losses = useMemo(() => decliningKeywords.filter(k => k.previousPos !== null && k.previousPos <= 3), [decliningKeywords]);
    const top10Losses = useMemo(() => decliningKeywords.filter(k => k.previousPos !== null && k.previousPos > 3 && k.previousPos <= 10), [decliningKeywords]);

    const barData = useMemo(() => {
        return decliningKeywords.slice(0, 15).map(k => ({
            keyword: k.keyword.length > 20 ? k.keyword.slice(0, 20) + '...' : k.keyword,
            riskScore: k.riskScore,
            netChange: k.netChange,
        }));
    }, [decliningKeywords]);

    const displayedDecliningKeywords = useMemo(() => sortedDecliningKeywords.slice(0, 25), [sortedDecliningKeywords]);

    const handleExportCsv = () => {
        const headers = ['Keyword', 'Volume', 'Previous Pos', 'Current Pos', 'Drop', 'Risk Score', 'Category'];
        const rows = displayedDecliningKeywords.map(row => [
            row.keyword,
            row.volume,
            row.previousPos ?? '',
            row.currentPos ?? '',
            row.netChange,
            row.riskScore,
            row.tags.join('; '),
        ]);
        downloadCsv(`losses-keywords-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    };

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

            {/* KPI Severity Banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-white p-5 rounded-xl border border-red-100 shadow-sm flex items-center justify-between">
                    <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Lost Top 3 Rankings</div>
                        <div className="text-2xl font-bold text-red-600 mt-1">{top3Losses.length} terms</div>
                        <div className="text-xs text-red-700 mt-0.5">High revenue impact</div>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg text-red-600">
                        <ShieldAlert className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-amber-100 shadow-sm flex items-center justify-between">
                    <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Lost First Page (Top 10)</div>
                        <div className="text-2xl font-bold text-amber-600 mt-1">{top10Losses.length} terms</div>
                        <div className="text-xs text-amber-700 mt-0.5">Moderate traffic loss</div>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Terms Declining</div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">{decliningKeywords.length} terms</div>
                        <div className="text-xs text-gray-400 mt-0.5">Across catalog</div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg text-gray-600">
                        <ArrowDownRight className="w-6 h-6" />
                    </div>
                </div>
            </div>

            {/* Risk Contribution Chart */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-base font-semibold text-gray-900 mb-1">Highest At-Risk Declines (By Risk Score)</h3>
                <p className="text-xs text-gray-400 mb-4">Combines position drop severity with keyword search volume.</p>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                            <XAxis type="number" tick={{ fontSize: 11 }} />
                            <YAxis type="category" dataKey="keyword" tick={{ fontSize: 11 }} width={110} />
                            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                            <Bar dataKey="riskScore" fill="#ef4444" radius={[0, 4, 4, 0]} name="Risk Score" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Defensive Action Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900">Defensive Priority Action Queue</h3>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">Sorted by Risk Score</span>
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
                                <SortableHeader label="Keyword" sortKey="keyword" current={sortConfig} onSort={toggleSort} />
                                <SortableHeader label="Volume" sortKey="volume" current={sortConfig} onSort={toggleSort} align="right" />
                                <SortableHeader label="Previous Pos" sortKey="previousPos" current={sortConfig} onSort={toggleSort} align="right" />
                                <SortableHeader label="Current Pos" sortKey="currentPos" current={sortConfig} onSort={toggleSort} align="right" />
                                <SortableHeader label="Drop" sortKey="netChange" current={sortConfig} onSort={toggleSort} align="right" />
                                <SortableHeader label="Risk Score" sortKey="riskScore" current={sortConfig} onSort={toggleSort} align="right" />
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Category</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white text-sm">
                            {displayedDecliningKeywords.map((row) => (
                                <tr key={row.keyword} className="hover:bg-gray-50">
                                    <td className="px-6 py-3.5 font-medium text-gray-900">
                                        {row.keyword}
                                    </td>
                                    <td className="px-6 py-3.5 text-right font-medium text-gray-700">{row.volume.toLocaleString()}</td>
                                    <td className="px-6 py-3.5 text-right font-medium text-gray-600">{row.previousPos ?? '-'}</td>
                                    <td className="px-6 py-3.5 text-right font-semibold text-gray-900">{row.currentPos ?? '-'}</td>
                                    <td className="px-6 py-3.5 text-right font-bold text-red-600">{row.netChange}</td>
                                    <td className="px-6 py-3.5 text-right font-bold text-red-600">{row.riskScore.toLocaleString()}</td>
                                    <td className="px-6 py-3.5">
                                        <div className="flex gap-1">
                                            {row.tags.slice(0, 2).map(t => (
                                                <span key={t} className="px-2 py-0.5 rounded text-xs bg-red-50 text-red-700 font-medium">{t}</span>
                                            ))}
                                        </div>
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
