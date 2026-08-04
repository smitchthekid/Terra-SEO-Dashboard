import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Target, Zap, Award, TrendingUp, Download } from 'lucide-react';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
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

export const OpportunitiesView: React.FC = () => {
    const { dateFrom, dateTo, setDateFrom, setDateTo } = useOutletContext<AppContextType>();
    const [subTab, setSubTab] = useState<'near_wins' | 'top3_push' | 'high_impact' | 'gains'>('near_wins');
    const [filterState, setFilterState] = useState<FilterState>(DEFAULT_FILTER_STATE);

    const tags = useMemo(() => getTags().map(t => t.tag), []);

    const allScoredKeywords: ScoredKeyword[] = useMemo(() => {
        return KEYWORDS.map(k => scoreKeyword(k, dateFrom, dateTo));
    }, [dateFrom, dateTo]);

    // Global filter bar state applied first -- both the scatterplot chart and
    // the table below derive from this same filtered dataset.
    const scoredKeywords: ScoredKeyword[] = useMemo(() => {
        return applyGlobalFilters(allScoredKeywords, filterState);
    }, [allScoredKeywords, filterState]);

    const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
    const toggleKeywordSelection = (keyword: string) => {
        setSelectedKeywords(prev => {
            const next = new Set(prev);
            if (next.has(keyword)) next.delete(keyword); else next.add(keyword);
            return next;
        });
    };

    const handleReset = () => { setFilterState(DEFAULT_FILTER_STATE); setSelectedKeywords(new Set()); };

    // Filter by subtab (applied on top of the global filter bar dataset)
    const filteredKeywords = useMemo(() => {
        if (subTab === 'near_wins') {
            return scoredKeywords
                .filter(k => k.currentPos !== null && k.currentPos >= 4 && k.currentPos <= 15);
        }
        if (subTab === 'top3_push') {
            return scoredKeywords
                .filter(k => k.currentPos !== null && k.currentPos >= 4 && k.currentPos <= 7);
        }
        if (subTab === 'high_impact') {
            return scoredKeywords
                .filter(k => k.opportunityScore > 50 || (k.currentPos !== null && k.currentPos <= 10 && k.netChange > 0));
        }
        // gains
        return scoredKeywords
            .filter(k => k.netChange > 0);
    }, [scoredKeywords, subTab]);

    // Table sort state -- defaults to each sub-tab's previous static sort
    // (Opportunity Score desc, or Net Change desc for the Gains tab) until
    // the user clicks a column header. Resets to that default on tab switch.
    const defaultSortForTab = (tab: typeof subTab): SortConfig =>
        tab === 'gains' ? { key: 'netChange', dir: 'desc' } : { key: 'opportunityScore', dir: 'desc' };
    const [sortConfig, setSortConfig] = useState<SortConfig>(() => defaultSortForTab(subTab));
    const handleSubTabChange = (tab: typeof subTab) => {
        setSubTab(tab);
        setSortConfig(defaultSortForTab(tab));
    };
    const toggleSort = (key: string) => {
        setSortConfig(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
    };
    const sortedKeywords = useMemo(() => {
        return sortByConfig(filteredKeywords, sortConfig, {
            keyword: (k) => k.keyword,
            volume: (k) => k.volume,
            currentPos: (k) => k.currentPos,
            netChange: (k) => k.netChange,
            opportunityScore: (k) => k.opportunityScore,
        });
    }, [filteredKeywords, sortConfig]);

    // Scatter plot data: Position vs Volume (Opportunity Space).
    // Bubble size (z) encodes search volume; color encodes net rank movement
    // direction rather than plot order, so the chart is actually meaningful.
    const scatterData = useMemo(() => {
        return filteredKeywords.slice(0, 40).map(k => ({
            keyword: k.keyword,
            x: k.currentPos || 20,
            y: k.volume,
            z: k.volume,
            netChange: k.netChange,
            opportunityScore: k.opportunityScore,
            selected: selectedKeywords.has(k.keyword),
        }));
    }, [filteredKeywords, selectedKeywords]);

    const displayedKeywords = useMemo(() => sortedKeywords.slice(0, 25), [sortedKeywords]);

    const handleExportCsv = () => {
        const headers = ['Keyword', 'Volume', 'Current Pos', 'Net Change', 'Opportunity Score', 'Category'];
        const rows = displayedKeywords.map(row => [
            row.keyword,
            row.volume,
            row.currentPos ?? '',
            row.netChange,
            row.opportunityScore,
            row.tags.join('; '),
        ]);
        downloadCsv(`opportunities-${subTab}-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
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

            {/* Sub-tabs Navigation */}
            <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
                {[
                    { id: 'near_wins', name: 'Near Wins (Pos 4-15)', icon: Target, count: scoredKeywords.filter(k => k.currentPos !== null && k.currentPos >= 4 && k.currentPos <= 15).length },
                    { id: 'top3_push', name: 'Top 3 Push Candidates', icon: Award, count: scoredKeywords.filter(k => k.currentPos !== null && k.currentPos >= 4 && k.currentPos <= 7).length },
                    { id: 'high_impact', name: 'High Impact Actions', icon: Zap, count: scoredKeywords.filter(k => k.opportunityScore > 50).length },
                    { id: 'gains', name: 'Rank Gains', icon: TrendingUp, count: scoredKeywords.filter(k => k.netChange > 0).length },
                ].map(t => {
                    const isActive = subTab === t.id;
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.id}
                            onClick={() => handleSubTabChange(t.id as any)}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${isActive
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                                }`}
                        >
                            <Icon className="w-4 h-4" />
                            {t.name}
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isActive ? 'bg-indigo-700 text-white' : 'bg-gray-100 text-gray-600'}`}>
                                {t.count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Opportunity Scatterplot Chart */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-1">
                    <h3 className="text-base font-semibold text-gray-900">Opportunity Space: Rank vs. Search Volume</h3>
                    {selectedKeywords.size > 0 && (
                        <button onClick={() => setSelectedKeywords(new Set())} className="text-xs text-gray-400 hover:text-gray-600 underline">Clear selection ({selectedKeywords.size})</button>
                    )}
                </div>
                <p className="text-xs text-gray-400 mb-4">Target terms in top-left (high volume, positions 4-10) for maximum traffic ROI. Bubble size = search volume; color = net rank movement{selectedKeywords.size > 0 ? '; selected rows are outlined.' : '.'}</p>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 10, left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis type="number" dataKey="x" name="Current Pos" unit=" pos" domain={[1, 20]} reversed tick={{ fontSize: 11 }} label={{ value: 'SERP Position (Lower is better)', position: 'insideBottom', offset: -5, style: { fontSize: 11, fill: '#9ca3af' } }} />
                            <YAxis type="number" dataKey="y" name="Search Volume" unit=" vol" tick={{ fontSize: 11 }} />
                            <ZAxis type="number" dataKey="z" range={[60, 500]} name="Volume" />
                            <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(val: any, name: any) => [val, name]} />
                            <Scatter data={scatterData}>
                                {scatterData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.netChange > 0 ? '#059669' : entry.netChange < 0 ? '#ef4444' : '#9ca3af'}
                                        fillOpacity={entry.selected || selectedKeywords.size === 0 ? 0.85 : 0.25}
                                        stroke={entry.selected ? '#1e293b' : 'none'}
                                        strokeWidth={entry.selected ? 2 : 0}
                                    />
                                ))}
                            </Scatter>
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Scored Opportunity Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900">
                        {subTab === 'near_wins' ? 'Near-Win Keywords (Pos 4-15)' :
                            subTab === 'top3_push' ? 'Top 3 Push Candidates (Pos 4-7)' :
                                subTab === 'high_impact' ? 'High Impact Action Queue' : 'Top Rank Gains'}
                    </h3>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">Showing {filteredKeywords.length} opportunities</span>
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
                                        checked={displayedKeywords.length > 0 && displayedKeywords.every(r => selectedKeywords.has(r.keyword))}
                                        onChange={(e) => {
                                            setSelectedKeywords(prev => {
                                                const next = new Set(prev);
                                                displayedKeywords.forEach(r => e.target.checked ? next.add(r.keyword) : next.delete(r.keyword));
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
                                <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Category</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white text-sm">
                            {displayedKeywords.map((row) => {
                                const isSelected = selectedKeywords.has(row.keyword);
                                return (
                                <tr key={row.keyword} onClick={() => toggleKeywordSelection(row.keyword)} className={`cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50 border-l-4 border-indigo-500 hover:bg-indigo-100' : 'hover:bg-gray-50 border-l-4 border-transparent'}`}>
                                    <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            checked={isSelected}
                                            onChange={() => toggleKeywordSelection(row.keyword)}
                                        />
                                    </td>
                                    <td className="px-6 py-3.5 font-medium text-gray-900">
                                        {row.keyword}
                                    </td>
                                    <td className="px-6 py-3.5 text-right font-medium text-gray-700">{row.volume.toLocaleString()}</td>
                                    <td className="px-6 py-3.5 text-right font-semibold text-gray-900">{row.currentPos ?? '-'}</td>
                                    <td className="px-6 py-3.5 text-right font-bold">
                                        <span className={row.netChange > 0 ? 'text-emerald-600' : row.netChange < 0 ? 'text-red-600' : 'text-gray-400'}>
                                            {row.netChange > 0 ? `+${row.netChange}` : row.netChange}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3.5 text-right font-bold text-emerald-600">{row.opportunityScore.toLocaleString()}</td>
                                    <td className="px-6 py-3.5">
                                        <div className="flex gap-1">
                                            {row.tags.slice(0, 2).map(t => (
                                                <span key={t} className="px-2 py-0.5 rounded text-xs bg-indigo-50 text-indigo-700 font-medium">{t}</span>
                                            ))}
                                        </div>
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
