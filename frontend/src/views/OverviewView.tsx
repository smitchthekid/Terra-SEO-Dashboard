import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Activity, ArrowUpRight, ArrowDownRight, Award, Download } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import type { AppContextType } from '../App';
import { KEYWORDS, getTags } from '../dataStore';
import { scoreKeyword, applyGlobalFilters } from '../metricsEngine';
import type { ScoredKeyword } from '../metricsEngine';
import { InsightCard } from '../components/InsightCard';
import { GlobalFilterBar } from '../components/GlobalFilterBar';
import type { FilterState } from '../components/GlobalFilterBar';
import { SortableHeader, sortByConfig } from '../components/SortableHeader';
import type { SortConfig } from '../components/SortableHeader';
import { downloadCsv } from '../csvUtils';
import { buildKeywordTrendSeries, TREND_LINE_COLORS } from '../components/positionSeries';

const DEFAULT_FILTER_STATE: FilterState = {
    keywordSearch: '',
    rankBand: 'all',
    valueTier: 'all',
    categoryTag: 'all',
    preset: 'all',
};

export const OverviewView: React.FC = () => {
    const { dateFrom, dateTo, setDateFrom, setDateTo } = useOutletContext<AppContextType>();
    const [filterState, setFilterState] = useState<FilterState>(DEFAULT_FILTER_STATE);

    const tags = useMemo(() => getTags().map(t => t.tag), []);

    const allScoredKeywords: ScoredKeyword[] = useMemo(() => {
        return KEYWORDS.map(k => scoreKeyword(k, dateFrom, dateTo));
    }, [dateFrom, dateTo]);

    // Single filtered dataset feeding both the chart and the table
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

    // Table sort state -- defaults to the view's previous static sort
    // (Value Score, descending) until the user clicks a column header.
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'valueScore', dir: 'desc' });
    const toggleSort = (key: string) => {
        setSortConfig(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
    };
    const sortedKeywords = useMemo(() => {
        return sortByConfig(scoredKeywords, sortConfig, {
            keyword: (k) => k.keyword,
            volume: (k) => k.volume,
            currentPos: (k) => k.currentPos,
            netChange: (k) => k.netChange,
            valueScore: (k) => k.valueScore,
            rankBand: (k) => k.rankBand,
        });
    }, [scoredKeywords, sortConfig]);

    // KPI Metrics
    const metrics = useMemo(() => {
        let totalValue = 0;
        let totalOppScore = 0;
        let totalRiskScore = 0;
        let gainedCount = 0;
        let lostCount = 0;
        let top3Count = 0;
        let firstPageCount = 0;

        scoredKeywords.forEach(k => {
            totalValue += k.valueScore;
            totalOppScore += k.opportunityScore;
            totalRiskScore += k.riskScore;
            if (k.netChange > 0) gainedCount++;
            if (k.netChange < 0) lostCount++;
            if (k.currentPos !== null && k.currentPos <= 3) top3Count++;
            if (k.currentPos !== null && k.currentPos <= 10) firstPageCount++;
        });

        return {
            totalValue,
            totalOppScore,
            totalRiskScore,
            gainedCount,
            lostCount,
            top3Count,
            firstPageCount,
            totalKeywords: scoredKeywords.length,
        };
    }, [scoredKeywords]);

    // Primary Trend Chart Data
    const chartData = useMemo(() => {
        if (scoredKeywords.length === 0) return [];
        const dateMap: Record<string, number[]> = {};

        scoredKeywords.slice(0, 150).forEach(k => {
            Object.entries(k.positions || {}).forEach(([dateStr, pos]) => {
                if (pos === null) return;
                if (!dateMap[dateStr]) dateMap[dateStr] = [];
                dateMap[dateStr].push(pos);
            });
        });

        return Object.entries(dateMap)
            .map(([date, ranks]) => ({
                date,
                avgRank: Number((ranks.reduce((a, b) => a + b, 0) / ranks.length).toFixed(1)),
            }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [scoredKeywords]);

    // When rows are selected in the table below, swap the aggregate trend
    // line for individual rank-history lines for each selected keyword --
    // looked up from the unfiltered set so a selection survives filter changes.
    const selectedTrendData = useMemo(() => {
        if (selectedKeywords.size === 0) return [];
        const selected = allScoredKeywords.filter(k => selectedKeywords.has(k.keyword));
        return buildKeywordTrendSeries(selected);
    }, [allScoredKeywords, selectedKeywords]);

    // Top Opportunities and Risks for Insights
    const topOpportunity = useMemo(() => {
        return [...scoredKeywords].sort((a, b) => b.opportunityScore - a.opportunityScore)[0];
    }, [scoredKeywords]);

    const topRisk = useMemo(() => {
        return [...scoredKeywords].sort((a, b) => b.riskScore - a.riskScore)[0];
    }, [scoredKeywords]);

    const topWinner = useMemo(() => {
        return [...scoredKeywords].sort((a, b) => b.netChange - a.netChange)[0];
    }, [scoredKeywords]);

    const displayedKeywords = useMemo(() => sortedKeywords.slice(0, 10), [sortedKeywords]);

    const handleExportCsv = () => {
        const headers = ['Keyword', 'Volume', 'Current Pos', 'Net Change', 'Value Score', 'Rank Band', 'Category'];
        const rows = displayedKeywords.map(row => [
            row.keyword,
            row.volume,
            row.currentPos ?? '',
            row.netChange,
            row.valueScore,
            row.rankBand,
            row.tags.join('; '),
        ]);
        downloadCsv(`overview-keywords-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
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

            {/* KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Est. Monthly Organic Value</div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">{metrics.totalValue.toLocaleString()} pts</div>
                        <div className="text-xs text-gray-400 mt-0.5">{metrics.totalKeywords} tracked keywords</div>
                    </div>
                    <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
                        <Activity className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-emerald-100 shadow-sm flex items-center justify-between">
                    <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Opportunity Pipeline</div>
                        <div className="text-2xl font-bold text-emerald-600 mt-1">{metrics.totalOppScore.toLocaleString()} pts</div>
                        <div className="text-xs text-emerald-700 mt-0.5">{metrics.gainedCount} keywords improved</div>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
                        <ArrowUpRight className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-red-100 shadow-sm flex items-center justify-between">
                    <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">At-Risk Value</div>
                        <div className="text-2xl font-bold text-red-600 mt-1">{metrics.totalRiskScore.toLocaleString()} pts</div>
                        <div className="text-xs text-red-700 mt-0.5">{metrics.lostCount} keywords declined</div>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg text-red-600">
                        <ArrowDownRight className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Top 10 Footprint</div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">{metrics.firstPageCount} terms</div>
                        <div className="text-xs text-indigo-600 font-medium mt-0.5">{metrics.top3Count} in Top 3</div>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
                        <Award className="w-6 h-6" />
                    </div>
                </div>
            </div>

            {/* Automated Insight Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {topOpportunity && (
                    <InsightCard
                        type="opportunity"
                        title={`High Upside: "${topOpportunity.keyword}"`}
                        description={`Pos ${topOpportunity.currentPos ?? '-'} with ${topOpportunity.volume.toLocaleString()} vol. High CTR gain potential.`}
                        metricLabel="Opp Score"
                        metricValue={topOpportunity.opportunityScore.toLocaleString()}
                    />
                )}
                {topRisk && (
                    <InsightCard
                        type="risk"
                        title={`High Risk: "${topRisk.keyword}"`}
                        description={`Dropped from Pos ${topRisk.previousPos ?? '-'} to Pos ${topRisk.currentPos ?? '-'}. High volume term.`}
                        metricLabel="Risk Score"
                        metricValue={topRisk.riskScore.toLocaleString()}
                    />
                )}
                {topWinner && (
                    <InsightCard
                        type="top_winner"
                        title={`Top Gain: "${topWinner.keyword}"`}
                        description={`Jumped +${topWinner.netChange} positions to Pos ${topWinner.currentPos ?? '-'}.`}
                        metricLabel="Net Rank"
                        metricValue={`+${topWinner.netChange}`}
                    />
                )}
            </div>

            {/* Main Trend Line Chart -- shows selected keywords' individual rank
                histories when the table below has a selection, otherwise the
                catalog-wide average trajectory. */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-1">
                    <h3 className="text-base font-semibold text-gray-900">
                        {selectedKeywords.size > 0 ? `Rank Trend -- ${selectedKeywords.size} Selected Keyword${selectedKeywords.size > 1 ? 's' : ''}` : 'Average Ranking Trajectory'}
                    </h3>
                    {selectedKeywords.size > 0 && (
                        <button onClick={() => setSelectedKeywords(new Set())} className="text-xs text-gray-400 hover:text-gray-600 underline">Clear selection</button>
                    )}
                </div>
                <p className="text-xs text-gray-400 mb-4">
                    {selectedKeywords.size > 0
                        ? 'Historical SERP position for each selected keyword. Lower is better.'
                        : 'Macro ranking trend over check-in dates across tracked catalog. Lower rank value indicates higher SERP position.'}
                </p>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        {selectedKeywords.size > 0 ? (
                            <LineChart data={selectedTrendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} dy={10} />
                                <YAxis reversed tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} domain={['dataMin - 1', 'dataMax + 1']} />
                                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                                {Array.from(selectedKeywords).map((kw, i) => (
                                    <Line key={kw} type="monotone" dataKey={kw} stroke={TREND_LINE_COLORS[i % TREND_LINE_COLORS.length]} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                                ))}
                            </LineChart>
                        ) : (
                            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} dy={10} />
                                <YAxis reversed tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} domain={['dataMin - 1', 'dataMax + 1']} />
                                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                                <Line type="monotone" dataKey="avgRank" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 3, fill: '#4f46e5' }} name="Avg Position" />
                            </LineChart>
                        )}
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Top Scored Keywords Overview Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900">Highest Value Keywords</h3>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">Sorted by Keyword Value Score</span>
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
                                <SortableHeader label="Value Score" sortKey="valueScore" current={sortConfig} onSort={toggleSort} align="right" />
                                <SortableHeader label="Rank Band" sortKey="rankBand" current={sortConfig} onSort={toggleSort} />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white text-sm">
                            {displayedKeywords
                                .map((row) => {
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
                                                <div className="flex gap-1 mt-1">
                                                    {row.tags.slice(0, 2).map(t => (
                                                        <span key={t} className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-500">{t}</span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-6 py-3.5 text-right font-medium text-gray-700">{row.volume.toLocaleString()}</td>
                                            <td className="px-6 py-3.5 text-right font-semibold text-gray-900">{row.currentPos ?? '-'}</td>
                                            <td className="px-6 py-3.5 text-right">
                                                <span className={`font-semibold ${row.netChange > 0 ? 'text-emerald-600' : row.netChange < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                                    {row.netChange > 0 ? `+${row.netChange}` : row.netChange}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3.5 text-right font-bold text-indigo-600">{row.valueScore.toLocaleString()}</td>
                                            <td className="px-6 py-3.5">
                                                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                                                    {row.rankBand}
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
