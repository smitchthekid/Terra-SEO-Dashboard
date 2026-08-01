import React, { useMemo } from 'react';
import { useParams, useOutletContext, Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Activity, Target, AlertTriangle, Download } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import type { AppContextType } from '../App';
import { KEYWORDS } from '../dataStore';
import { scoreKeyword } from '../metricsEngine';
import { downloadCsv } from '../csvUtils';

export const KeywordDetailView: React.FC = () => {
    const { keywordId } = useParams<{ keywordId: string }>();
    const { dateFrom, dateTo } = useOutletContext<AppContextType>();

    const decodedKeyword = decodeURIComponent(keywordId || '');

    const record = useMemo(() => {
        return KEYWORDS.find(k => k.keyword.toLowerCase() === decodedKeyword.toLowerCase()) || KEYWORDS[0];
    }, [decodedKeyword]);

    const scored = useMemo(() => {
        if (!record) return null;
        return scoreKeyword(record, dateFrom, dateTo);
    }, [record, dateFrom, dateTo]);

    const chartData = useMemo(() => {
        if (!record || !record.positions) return [];
        return Object.entries(record.positions)
            .map(([date, pos]) => ({ date, pos }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [record]);

    const handleExportCsv = () => {
        if (!scored) return;
        const headers = ['Date', 'Position'];
        const rows = chartData.map(row => [row.date, row.pos ?? '']);
        const safeKeyword = scored.keyword.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
        downloadCsv(`keyword-${safeKeyword}-rank-history-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    };

    if (!record || !scored) {
        return (
            <div className="p-8 text-center bg-white rounded-xl shadow-sm">
                <p className="text-gray-500">Keyword not found.</p>
                <Link to="/overview" className="mt-4 inline-block text-indigo-600 font-semibold text-sm">
                    Back to Overview
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Top Navigation */}
            <div className="flex items-center justify-between">
                <Link to="/overview" className="inline-flex items-center text-sm font-semibold text-indigo-600 hover:text-indigo-700">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back to Overview
                </Link>
                <div className="flex gap-1.5">
                    {scored.tags.map(t => (
                        <span key={t} className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">{t}</span>
                    ))}
                </div>
            </div>

            {/* Keyword Header Card */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">{scored.keyword}</h2>
                    {scored.urlInSerp && (
                        <a
                            href={scored.urlInSerp}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-600 hover:underline inline-flex items-center gap-1 mt-1 font-medium"
                        >
                            {scored.urlInSerp} <ExternalLink className="w-3 h-3" />
                        </a>
                    )}
                </div>
                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <div className="text-xs text-gray-400 font-semibold uppercase">Search Volume</div>
                        <div className="text-xl font-bold text-gray-900">{scored.volume.toLocaleString()}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-gray-400 font-semibold uppercase">Current Rank</div>
                        <div className="text-2xl font-extrabold text-indigo-600">Pos {scored.currentPos ?? '-'}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-gray-400 font-semibold uppercase">Net Change</div>
                        <div className={`text-xl font-bold ${scored.netChange > 0 ? 'text-emerald-600' : scored.netChange < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                            {scored.netChange > 0 ? `+${scored.netChange}` : scored.netChange}
                        </div>
                    </div>
                </div>
            </div>

            {/* Score Breakdown Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-white p-5 rounded-xl border border-indigo-100 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-500 uppercase">Value Score</span>
                        <Activity className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="text-2xl font-bold text-indigo-600">{scored.valueScore.toLocaleString()}</div>
                    <p className="text-xs text-gray-500 mt-1">Est. organic traffic potential based on rank CTR.</p>
                </div>

                <div className="bg-white p-5 rounded-xl border border-emerald-100 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-500 uppercase">Opportunity Score</span>
                        <Target className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="text-2xl font-bold text-emerald-600">{scored.opportunityScore.toLocaleString()}</div>
                    <p className="text-xs text-gray-500 mt-1">Proximity boost for positions 4-15.</p>
                </div>

                <div className="bg-white p-5 rounded-xl border border-red-100 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-500 uppercase">Risk Score</span>
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                    </div>
                    <div className="text-2xl font-bold text-red-600">{scored.riskScore.toLocaleString()}</div>
                    <p className="text-xs text-gray-500 mt-1">Exposure risk from recent position drops.</p>
                </div>
            </div>

            {/* Historical Rank Chart */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-1">
                    <h3 className="text-base font-semibold text-gray-900">Historical Rank Trajectory</h3>
                    <button
                        onClick={handleExportCsv}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 bg-white hover:bg-gray-50 hover:border-gray-400 transition-colors"
                    >
                        <Download className="w-3.5 h-3.5" />
                        Export CSV
                    </button>
                </div>
                <p className="text-xs text-gray-400 mb-4">Position checks across all recording dates.</p>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                            <YAxis reversed domain={[1, 30]} tick={{ fontSize: 11 }} label={{ value: 'SERP Position', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#9ca3af' } }} />
                            <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                            <Line type="monotone" dataKey="pos" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, fill: '#4f46e5' }} connectNulls name="SERP Position" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};
