import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { getHighImpactItems } from './dataStore';

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
                <span className="ml-1 text-indigo-500">{current.dir === 'asc' ? '↑' : '↓'}</span>
            )}
        </div>
    </th>
);

export const HighImpactView = () => {
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'impactScore', dir: 'desc' });

    const { data: items = [], isLoading } = useQuery({
        queryKey: ['high-impact-items'],
        queryFn: async () => {
            return getHighImpactItems();
        },
    });

    const sortedItems = useMemo(() => {
        return [...items].sort((a: any, b: any) => {
            let av = a[sortConfig.key] ?? -Infinity;
            let bv = b[sortConfig.key] ?? -Infinity;

            if (typeof av === 'string' && typeof bv === 'string') {
                const cmp = av.localeCompare(bv);
                return sortConfig.dir === 'asc' ? cmp : -cmp;
            }

            const cmp = (av as number) - (bv as number);
            return sortConfig.dir === 'asc' ? cmp : -cmp;
        });
    }, [items, sortConfig]);

    const toggleSort = (key: string) => {
        setSortConfig(prev => ({
            key, dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc'
        }));
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">High Impact Items</h2>
                <p className="text-sm text-gray-500 mb-6">
                    Keywords prioritized by highest impact potential (highest search volume combined with low ranking). Top 50 impact candidates are flagged for inspection.
                </p>

                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200 mb-4">
                        <thead className="bg-gray-50">
                            <tr>
                                <SortableHeader label="Keyword" sortKey="keyword" current={sortConfig} onSort={toggleSort} />
                                <SortableHeader label="Volume" sortKey="volume" current={sortConfig} onSort={toggleSort} align="right" />
                                <SortableHeader label="Cur Rank" sortKey="currentRank" current={sortConfig} onSort={toggleSort} align="right" />
                                <SortableHeader label="Prev Rank" sortKey="previous90dRank" current={sortConfig} onSort={toggleSort} align="right" />
                                <SortableHeader label="Net Change" sortKey="rankChange" current={sortConfig} onSort={toggleSort} align="right" />
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
                                <tr><td colSpan={11} className="px-6 py-8 text-center text-sm font-medium text-gray-500 animate-pulse">Calculating custom metrics...</td></tr>
                            ) : sortedItems.length === 0 ? (
                                <tr><td colSpan={11} className="px-6 py-8 text-center text-sm text-gray-500">No data available.</td></tr>
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
                                        <td className="px-6 py-4 text-sm text-gray-700 font-medium text-right">{row.currentRank ?? '-'}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500 text-right">{row.previous90dRank ?? '-'}</td>
                                        <td className="px-6 py-4 text-sm text-gray-700 font-medium text-right">
                                            {row.rankChange !== null
                                                ? (row.rankChange > 0 ? <span className="text-red-500">+{row.rankChange}</span> : (row.rankChange < 0 ? <span className="text-emerald-500">{row.rankChange}</span> : '0'))
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
                                            {row.lowVolume && (
                                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">{row.lowVolume}</span>
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
