import React from 'react';
import { Search, RotateCcw, Zap } from 'lucide-react';
import { ALL_DATES } from '../dataStore';

export interface FilterState {
    keywordSearch: string;
    rankBand: string;
    valueTier: string;
    categoryTag: string;
    preset: string;
}

export const ANALYST_PRESETS = [
    { id: 'all', name: 'All Keywords' },
    { id: 'highest_value_opps', name: 'Highest Value Opportunities' },
    { id: 'near_wins', name: 'Near Wins (Pos 4-15)' },
    { id: 'top3_push', name: 'Top 3 Push Candidates' },
    { id: 'highest_value_declines', name: 'Highest Value Declines' },
    { id: 'first_page_drops', name: 'Lost First Page' },
];

export interface GlobalFilterBarProps {
    dateFrom: string;
    dateTo: string;
    setDateFrom: (d: string) => void;
    setDateTo: (d: string) => void;
    filterState: FilterState;
    setFilterState: React.Dispatch<React.SetStateAction<FilterState>>;
    tags: string[];
    onReset: () => void;
}

export const GlobalFilterBar: React.FC<GlobalFilterBarProps> = ({
    dateFrom,
    dateTo,
    setDateFrom,
    setDateTo,
    filterState,
    setFilterState,
    tags,
    onReset,
}) => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3">
            {/* Top row: Analyst Presets */}
            <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-gray-100">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center mr-2">
                    <Zap className="w-3.5 h-3.5 text-amber-500 mr-1" /> Presets:
                </span>
                {ANALYST_PRESETS.map((p) => {
                    const isActive = filterState.preset === p.id;
                    return (
                        <button
                            key={p.id}
                            onClick={() => setFilterState(prev => ({ ...prev, preset: p.id }))}
                            className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${isActive
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            {p.name}
                        </button>
                    );
                })}
            </div>

            {/* Bottom row: Filter Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-center">
                {/* Search */}
                <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                        type="text"
                        value={filterState.keywordSearch}
                        onChange={e => setFilterState(prev => ({ ...prev, keywordSearch: e.target.value }))}
                        placeholder="Search keyword..."
                        className="pl-9 pr-3 py-1.5 w-full text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>

                {/* Rank Band */}
                <div>
                    <select
                        value={filterState.rankBand}
                        onChange={e => setFilterState(prev => ({ ...prev, rankBand: e.target.value }))}
                        className="w-full py-1.5 px-2 text-xs border border-gray-300 rounded-lg bg-white focus:ring-1 focus:ring-indigo-500"
                    >
                        <option value="all">All Rank Bands</option>
                        <option value="Top 3">Top 3 (Pos 1-3)</option>
                        <option value="Pos 4-10">Pos 4-10 (First Page)</option>
                        <option value="Pos 11-20">Pos 11-20 (Second Page)</option>
                        <option value="Pos 21+">Pos 21+</option>
                    </select>
                </div>

                {/* Product Category Tag */}
                <div>
                    <select
                        value={filterState.categoryTag}
                        onChange={e => setFilterState(prev => ({ ...prev, categoryTag: e.target.value }))}
                        className="w-full py-1.5 px-2 text-xs border border-gray-300 rounded-lg bg-white focus:ring-1 focus:ring-indigo-500"
                    >
                        <option value="all">All Categories</option>
                        {tags.map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                </div>

                {/* Date Ranges */}
                <div className="flex items-center gap-1.5">
                    <select
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        className="w-1/2 py-1.5 px-1.5 text-[11px] border border-gray-300 rounded-lg bg-white"
                    >
                        {[...new Set(ALL_DATES)].sort().map(d => (
                            <option key={`f-${d}`} value={d}>{d}</option>
                        ))}
                    </select>
                    <span className="text-xs text-gray-400">to</span>
                    <select
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        className="w-1/2 py-1.5 px-1.5 text-[11px] border border-gray-300 rounded-lg bg-white"
                    >
                        {[...new Set(ALL_DATES)].sort().map(d => (
                            <option key={`t-${d}`} value={d}>{d}</option>
                        ))}
                    </select>
                </div>

                {/* Reset button */}
                <div className="flex justify-end">
                    <button
                        onClick={onReset}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <RotateCcw className="w-3.5 h-3.5" /> Reset Filters
                    </button>
                </div>
            </div>
        </div>
    );
};
