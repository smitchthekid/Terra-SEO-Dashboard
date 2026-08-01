import React from 'react';
import { TrendingUp, AlertTriangle, Target, Award, ArrowUpRight } from 'lucide-react';

export interface InsightCardProps {
    type: 'opportunity' | 'risk' | 'top_winner' | 'action_needed';
    title: string;
    description: string;
    metricLabel: string;
    metricValue: string | number;
    onClick?: () => void;
}

export const InsightCard: React.FC<InsightCardProps> = ({
    type,
    title,
    description,
    metricLabel,
    metricValue,
    onClick,
}) => {
    const config = {
        opportunity: {
            bg: 'bg-emerald-50/70 border-emerald-100',
            icon: Target,
            iconColor: 'text-emerald-600',
            badgeBg: 'bg-emerald-100 text-emerald-800',
        },
        risk: {
            bg: 'bg-red-50/70 border-red-100',
            icon: AlertTriangle,
            iconColor: 'text-red-600',
            badgeBg: 'bg-red-100 text-red-800',
        },
        top_winner: {
            bg: 'bg-indigo-50/70 border-indigo-100',
            icon: Award,
            iconColor: 'text-indigo-600',
            badgeBg: 'bg-indigo-100 text-indigo-800',
        },
        action_needed: {
            bg: 'bg-amber-50/70 border-amber-100',
            icon: TrendingUp,
            iconColor: 'text-amber-600',
            badgeBg: 'bg-amber-100 text-amber-800',
        },
    }[type];

    const Icon = config.icon;

    return (
        <div
            onClick={onClick}
            className={`p-4 rounded-xl border ${config.bg} flex items-start justify-between cursor-pointer hover:shadow-md transition-all group`}
        >
            <div className="flex items-start space-x-3">
                <div className={`p-2 rounded-lg bg-white shadow-xs ${config.iconColor}`}>
                    <Icon className="w-5 h-5" />
                </div>
                <div>
                    <h4 className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors flex items-center gap-1">
                        {title}
                        <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </h4>
                    <p className="text-xs text-gray-600 mt-0.5 max-w-sm">{description}</p>
                </div>
            </div>
            <div className="text-right pl-3">
                <div className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block ${config.badgeBg}`}>
                    {metricValue}
                </div>
                <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mt-1">
                    {metricLabel}
                </div>
            </div>
        </div>
    );
};
