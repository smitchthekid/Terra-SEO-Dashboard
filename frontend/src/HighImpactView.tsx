import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { getHighImpactItems, ALL_DATES } from './dataStore';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts';

interface SortConfig {
    key: string;
    dir: 'asc' | 'desc';
}

const SortableHeader = ({
    label, sortKey, current, onSort, align = 'left',
}: {
    label: string; sortKey: string; current: SortConfig; onSort: (key: string) => void; align?: 'left' | 'right';
}) => (
    <th
        className={`px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 ${align === 'right' ? 'text-right' : 'text-left'}`}
        onClick={() => onSort(sortKey)}
    >
        <div className={`flex items-center ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
            {label}
            {current.key === sortKey && (
                <span className="ml-1 text-indigo-500">{current.dir === 'asc' ? '\u2191' : '\u2193'}</span>
            )}
        </div>
    </th>
);

type VisibilityFilter = 'all' | 'lost_top_5' | 'lost_top_10';

export const HighImpactView = () => {
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'rankChange', dir: 'desc' });
    const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');
    const [selectedTag, setSelectedTag] = useState('');

    const { data: items = [], isLoading } = useQuery({
        queryKey: ['high-impact-items'],
        queryFn: async () => {
            return getHighImpactItems();
        },
    });

    // Apply visibility and tag filters
    const filteredItems = useMemo(() => {
        let result = [...items];

        if (visibilityFilter === 'lost_top_5') {
            result = result.filter((r: any) => r.visibilityLoss === 'Lost Top 5');
        } else if (visibilityFilter === 'lost_top_10') {
            result = result.filter((r: any) =>
                r.visibilityLoss === 'Lost Top 5' || r.visibilityLoss === 'Lost Top 10'
            );
        }

        if (selectedTag) {
            result = result.filter((r: any) =>
                r.tags?.some((t: string) => t.toLowerCase() === selectedTag.toLowerCase())
            );
        }

        return result;
    }, [items, visibilityFilter, selectedTag]);

    // Sort items
    const sortedItems = useMemo(() => {
        return [...filteredItems].sort((a: any, b: any) => {
            let av = a[sortConfig.key] ?? -Infinity;
            let bv = b[sortConfig.key] ?? -Infinity;

            if (typeof av === 'string' && typeof bv === 'string') {
                const cmp = av.localeCompare(bv);
                return sortConfig.dir === 'asc' ? cmp : -cmp;
            }

            const cmp = (av as number) - (bv as number);
            return sortConfig.dir === 'asc' ? cmp : -cmp;
        });
    }, [filteredItems, sortConfig]);

    // Build timeline chart data from top 5 items by rank change
    const timelineData = useMemo(() => {
        if (sortedItems.length === 0) return [];

        const topKeywords = sortedItems.slice(0, 5);
        const sortedDates = ALL_DATES.slice().sort();
        // Use last 10 dates for readability
        const recentDates = sortedDates.slice(-10);

        const dateMap: Record<string, any> = {};
        topKeywords.forEach((item: any) => {
            if (!item.positions) return;
            recentDates.forEach(dateStr => {
                const pos = item.positions[dateStr];
                if (pos === null || pos === undefined) return;
                if (!dateMap[dateStr]) dateMap[dateStr] = { date: dateStr };
                dateMap[dateStr][item.keyword] = pos;
            });
        });

        return Object.values(dateMap).sort((a: any, b: any) => a.date.localeCompare(b.date));
    }, [sortedItems]);

    const timelineKeywords = useMemo(() => {
        if (timelineData.length === 0) return [];
        return Object.keys(timelineData[0] || {}).filter(k => k !== 'date');
    }, [timelineData]);

    // Build category pie chart data from ALL filtered items
    const categoryPieData = useMemo(() => {
        const tagCounts: Record<string, { count: number; volume: number }> = {};

        filteredItems.forEach((item: any) => {
            const tags = item.tags && item.tags.length > 0 ? item.tags : ['Uncategorized'];
            tags.forEach((tag: string) => {
                if (!tagCounts[tag]) tagCounts[tag] = { count: 0, volume: 0 };
                tagCounts[tag].count += 1;
                tagCounts[tag].volume += item.volume || 0;
            });
        });

        const sorted = Object.entries(tagCounts)
            .sort((a, b) => b[1].volume - a[1].volume);

        const top = sorted.slice(0, 6).map(([name, data]) => ({
            name,
            value: data.volume,
            count: data.count,
        }));
        const rest = sorted.slice(6);
        if (rest.length > 0) {
            top.push({
                name: 'Other',
                value: rest.reduce((s, [, d]) => s + d.volume, 0),
                count: rest.reduce((s, [, d]) => s + d.count, 0),
            });
        }
        return top;
    }, [filteredItems]);

    // Filter counts for button badges
    const filterCounts = useMemo(() => {
        let lostTop5 = 0;
        let lostFirstPage = 0;
        items.forEach((item: any) => {
            if (item.visibilityLoss === 'Lost Top 5') { lostTop5++; lostFirstPage++; }
            else if (item.visibilityLoss === 'Lost Top 10') lostFirstPage++;
        });
        return { lostTop5, lostFirstPage };
    }, [items]);

    const toggleSort = (key: string) => {
        setSortConfig(prev => ({
            key, dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc'
        }));
    };

    const lineColors = ["#044a63", "#ad4385", "#ffa600", "#f75c5c", "#5480B3"];
    const pieColors = ["#044a63", "#073763", "#2f3971", "#44407b", "#7a4387", "#ad4385", "#d94875", "#f75c5c", "#ff7e3b", "#ffa600"];

    return (
        <div className="space-y-6">
            {/* Header and Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">High Impact Items</h2>
                <p className="text-sm text-gray-500 mb-4">
                    Keywords with notable rank changes, filtered to volume 100+ with active rank data. Sorted by largest total rank change.
                </p>

                {/* Button Filters */}
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setVisibilityFilter('all')}
                        className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${visibilityFilter === 'all'
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            }`}
                    >
                        All ({items.length})
                    </button>
                    <button
                        onClick={() => setVisibilityFilter('lost_top_5')}
                        className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${visibilityFilter === 'lost_top_5'
                            ? 'bg-red-600 text-white border-red-600'
                            : 'bg-white text-red-700 border-red-300 hover:bg-red-50'
                            }`}
                    >
                        Lost Top 5 ({filterCounts.lostTop5})
                    </button>
                    <button
                        onClick={() => setVisibilityFilter('lost_top_10')}
                        className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${visibilityFilter === 'lost_top_10'
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'
                            }`}
                    >
                        Lost First Page ({filterCounts.lostFirstPage})
                    </button>
                    {selectedTag && (
                        <div className="flex items-center gap-2 ml-4 pl-4 border-l border-gray-200">
                            <span className="text-xs text-gray-500">Category:</span>
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">{selectedTag}</span>
                            <button
                                onClick={() => setSelectedTag('')}
                                className="text-xs text-gray-400 hover:text-gray-600 underline"
                            >
                                Clear
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Category Pie Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 col-span-1 min-h-[380px]">
                    <h3 className="text-base font-semibold text-gray-900 mb-1">Category Breakdown</h3>
                    <p className="text-xs text-gray-400 mb-4">Click a segment to filter the table by category.</p>
                    <div className="h-80 overflow-visible">
                        {categoryPieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                    <Pie
                                        data={categoryPieData}
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
                                            const name = categoryPieData[index]?.name;
                                            if (name === 'Other') return;
                                            setSelectedTag(prev => prev === name ? '' : name);
                                        }}
                                        style={{ cursor: 'pointer', fontSize: '11px' }}
                                    >
                                        {categoryPieData.map((_entry: any, i: number) => (
                                            <Cell
                                                key={`cell-${i}`}
                                                fill={pieColors[i % pieColors.length]}
                                                opacity={selectedTag && selectedTag !== _entry.name ? 0.3 : 1}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value: any, _name: any, props: any) => [
                                            `${new Intl.NumberFormat('en-US').format(Number(value))} vol (${props.payload.count} keywords)`,
                                            props.payload.name
                                        ]}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400 text-sm">No data</div>
                        )}
                    </div>
                </div>

                {/* Timeline Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 col-span-1 lg:col-span-2 min-h-[380px]">
                    <h3 className="text-base font-semibold text-gray-900 mb-1">Rank Timeline (Top 5)</h3>
                    <p className="text-xs text-gray-400 mb-4">Position history for the top 5 items by rank change over recent check-in dates.</p>
                    {isLoading ? (
                        <div className="flex items-center justify-center h-64 border-2 border-dashed border-gray-200 rounded-lg">
                            <span className="text-gray-400 font-medium animate-pulse">Loading chart...</span>
                        </div>
                    ) : timelineData.length === 0 ? (
                        <div className="flex items-center justify-center h-64 border-2 border-dashed border-gray-200 rounded-lg">
                            <span className="text-gray-400 font-medium">No position history available for selected filters</span>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={timelineData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
                                    tick={{ fontSize: 12, fill: '#6b7280' }}
                                    axisLine={false}
                                    tickLine={false}
                                    domain={['dataMin - 1', 'dataMax + 1']}
                                    label={{ value: 'Position', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#9ca3af' } }}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    itemStyle={{ fontSize: '12px', fontWeight: 500 }}
                                    labelStyle={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}
                                />
                                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                                {timelineKeywords.map((key, i) => (
                                    <Line
                                        type="monotone"
                                        key={key}
                                        dataKey={key}
                                        stroke={lineColors[i % lineColors.length]}
                                        strokeWidth={2}
                                        dot={{ r: 3, fill: lineColors[i % lineColors.length] }}
                                        connectNulls
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Results count */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">Keyword Details</h3>
                    <span className="text-sm text-gray-500">
                        Showing {sortedItems.length} of {items.length} keywords
                    </span>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <SortableHeader label="Keyword" sortKey="keyword" current={sortConfig} onSort={toggleSort} />
                                <SortableHeader label="Volume" sortKey="volume" current={sortConfig} onSort={toggleSort} align="right" />
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tags</th>
                                <SortableHeader label="Cur Rank" sortKey="currentRank" current={sortConfig} onSort={toggleSort} align="right" />
                                <SortableHeader label="Prev Rank" sortKey="previous90dRank" current={sortConfig} onSort={toggleSort} align="right" />
                                <SortableHeader label="Rank Change" sortKey="rankChange" current={sortConfig} onSort={toggleSort} align="right" />
                                <SortableHeader label="Impact Score" sortKey="impactScore" current={sortConfig} onSort={toggleSort} align="right" />
                                <SortableHeader label="Power Score" sortKey="powerScore" current={sortConfig} onSort={toggleSort} align="right" />
                                <SortableHeader label="Hist Avg" sortKey="histAvg" current={sortConfig} onSort={toggleSort} align="right" />
                                <SortableHeader label="Hist Best" sortKey="histMin" current={sortConfig} onSort={toggleSort} align="right" />
                                <SortableHeader label="Hist Worst" sortKey="histMax" current={sortConfig} onSort={toggleSort} align="right" />
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Alerts</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {isLoading ? (
                                <tr><td colSpan={12} className="px-6 py-8 text-center text-sm font-medium text-gray-500 animate-pulse">Calculating custom metrics...</td></tr>
                            ) : sortedItems.length === 0 ? (
                                <tr><td colSpan={12} className="px-6 py-8 text-center text-sm text-gray-500">No items match the current filters.</td></tr>
                            ) : sortedItems.map((row: any, i: number) => {
                                const isWarning = row.inspectionRequired;
                                const pScoreNegative = row.powerScore !== null && row.powerScore < 0;

                                return (
                                    <tr key={i} className={`hover:bg-gray-50 ${isWarning ? 'bg-amber-50/30' : ''}`}>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900 border-l-4 border-transparent" style={{ borderLeftColor: isWarning ? '#f59e0b' : 'transparent' }}>
                                            <div className="flex items-center">
                                                {isWarning && <AlertTriangle className="w-4 h-4 text-amber-500 mr-2 flex-shrink-0" />}
                                                {row.keyword}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-700 text-right">{row.volume.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-sm">
                                            <div className="flex flex-wrap gap-1">
                                                {row.tags?.slice(0, 2).map((t: string) => (
                                                    <span
                                                        key={t}
                                                        className={`px-1.5 py-0.5 rounded text-xs font-medium cursor-pointer transition-colors ${selectedTag === t
                                                            ? 'bg-indigo-200 text-indigo-800'
                                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                            }`}
                                                        onClick={() => setSelectedTag(prev => prev === t ? '' : t)}
                                                    >
                                                        {t}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-700 font-medium text-right">{row.currentRank ?? '-'}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500 text-right">{row.previous90dRank ?? '-'}</td>
                                        <td className="px-6 py-4 text-sm text-gray-700 font-medium text-right">
                                            {row.rankChange !== null
                                                ? (row.rankChange > 0 ? <span className="text-red-500 font-bold">+{row.rankChange}</span> : (row.rankChange < 0 ? <span className="text-emerald-500 font-bold">{row.rankChange}</span> : '0'))
                                                : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-indigo-600 text-right">{row.impactScore > 0 ? row.impactScore : '-'}</td>
                                        <td className={`px-6 py-4 text-sm text-right ${pScoreNegative ? 'text-red-500 font-semibold' : 'text-gray-700'}`}>
                                            {row.powerScore !== null ? row.powerScore : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 text-right">{row.histAvg ?? '-'}</td>
                                        <td className="px-6 py-4 text-sm text-emerald-600 text-right font-medium">{row.histMin ?? '-'}</td>
                                        <td className="px-6 py-4 text-sm text-red-600 text-right font-medium">{row.histMax ?? '-'}</td>
                                        <td className="px-6 py-4 text-sm text-center flex flex-col gap-1 items-center justify-center">
                                            {row.visibilityLoss && (
                                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 border border-red-200 shadow-sm">{row.visibilityLoss}</span>
                                            )}
                                            {row.impactImproved && (
                                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-sm">{row.impactImproved}</span>
                                            )}
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
