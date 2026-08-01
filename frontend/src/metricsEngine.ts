/**
 * Shared Metrics Engine
 * Provides unified scoring, rank banding, and value formulas across all views.
 */

import type { KeywordRecord } from './dataStore';
import type { FilterState } from './components/GlobalFilterBar';

export interface ScoredKeyword extends KeywordRecord {
    valueScore: number;
    opportunityScore: number;
    riskScore: number;
    momentumScore: number;
    rankBand: 'Top 3' | 'Pos 4-10' | 'Pos 11-20' | 'Pos 21+';
    changeType: 'new_win' | 'near_win' | 'top3_push' | 'stable' | 'soft_decline' | 'hard_decline' | 'threshold_loss';
    currentPos: number | null;
    previousPos: number | null;
    netChange: number;
    avgPos: number | null;
}

/**
 * Standard CTR Curve estimation based on SERP Position (1-10+)
 */
export function getEstimatedCTR(pos: number | null): number {
    if (pos === null || pos <= 0) return 0;
    if (pos === 1) return 0.317;
    if (pos === 2) return 0.247;
    if (pos === 3) return 0.186;
    if (pos === 4) return 0.136;
    if (pos === 5) return 0.095;
    if (pos === 6) return 0.062;
    if (pos === 7) return 0.041;
    if (pos === 8) return 0.031;
    if (pos === 9) return 0.024;
    if (pos === 10) return 0.018;
    if (pos <= 20) return 0.008;
    return 0.002;
}

/**
 * Assign Rank Band based on position
 */
export function getRankBand(pos: number | null): 'Top 3' | 'Pos 4-10' | 'Pos 11-20' | 'Pos 21+' {
    if (pos !== null && pos >= 1 && pos <= 3) return 'Top 3';
    if (pos !== null && pos >= 4 && pos <= 10) return 'Pos 4-10';
    if (pos !== null && pos >= 11 && pos <= 20) return 'Pos 11-20';
    return 'Pos 21+';
}

/**
 * Calculate Keyword Value Score (Search Volume * Estimated CTR)
 */
export function calculateValueScore(volume: number, pos: number | null): number {
    const ctr = getEstimatedCTR(pos);
    return Math.round(volume * ctr);
}

/**
 * Calculate Opportunity Score:
 * Highest for keywords in Pos 4-15 with high volume where small rank gains unlock massive CTR jumps.
 */
export function calculateOpportunityScore(volume: number, pos: number | null, netChange: number): number {
    if (pos === null || pos > 20) return 0;
    let proximityFactor = 0;
    if (pos >= 4 && pos <= 10) proximityFactor = 1.0;
    else if (pos >= 11 && pos <= 15) proximityFactor = 0.6;
    else if (pos >= 1 && pos <= 3) proximityFactor = 0.3; // already top 3

    const potentialGainCTR = getEstimatedCTR(Math.max(1, pos - 3)) - getEstimatedCTR(pos);
    const momentumBonus = netChange > 0 ? 1.2 : netChange < 0 ? 0.8 : 1.0;

    return Math.round(volume * potentialGainCTR * proximityFactor * momentumBonus);
}

/**
 * Calculate Risk Score:
 * Highest for high-volume keywords dropping out of Top 3 or Top 10.
 */
export function calculateRiskScore(volume: number, currentPos: number | null, previousPos: number | null): number {
    if (previousPos === null) return 0;
    const currentCTR = getEstimatedCTR(currentPos);
    const previousCTR = getEstimatedCTR(previousPos);
    const lostCTR = Math.max(0, previousCTR - currentCTR);

    let thresholdMultiplier = 1.0;
    if (previousPos <= 3 && (currentPos === null || currentPos > 3)) {
        thresholdMultiplier = 2.0; // lost Top 3
    } else if (previousPos <= 10 && (currentPos === null || currentPos > 10)) {
        thresholdMultiplier = 1.5; // lost Top 10
    }

    return Math.round(volume * lostCTR * thresholdMultiplier);
}

/**
 * Enhance KeywordRecord with scored metrics
 */
export function scoreKeyword(record: KeywordRecord, dateFrom: string, dateTo: string): ScoredKeyword {
    const positions = record.positions || {};
    const dates = Object.keys(positions).sort();

    const fromDate = dateFrom || (dates.length > 1 ? dates[dates.length - 2] : dates[0]);
    const toDate = dateTo || dates[dates.length - 1];

    const currentPos = positions[toDate] ?? null;
    const previousPos = positions[fromDate] ?? null;

    let netChange = 0;
    if (previousPos !== null && currentPos !== null) {
        netChange = previousPos - currentPos; // Positive means rank improved (e.g. 10 -> 4 is +6)
    } else if (previousPos === null && currentPos !== null) {
        netChange = 20 - currentPos;
    } else if (previousPos !== null && currentPos === null) {
        netChange = currentPos !== null ? 0 : -20;
    }

    const validPositions = Object.values(positions).filter((p): p is number => p !== null && p > 0);
    const avgPos = validPositions.length > 0
        ? Number((validPositions.reduce((a, b) => a + b, 0) / validPositions.length).toFixed(1))
        : null;

    const valueScore = calculateValueScore(record.volume, currentPos);
    const opportunityScore = calculateOpportunityScore(record.volume, currentPos, netChange);
    const riskScore = calculateRiskScore(record.volume, currentPos, previousPos);
    const momentumScore = netChange * (record.volume / 100);
    const rankBand = getRankBand(currentPos);

    let changeType: ScoredKeyword['changeType'] = 'stable';
    if (previousPos === null && currentPos !== null) changeType = 'new_win';
    else if (currentPos !== null && currentPos >= 4 && currentPos <= 10 && netChange > 0) changeType = 'near_win';
    else if (currentPos !== null && currentPos >= 4 && currentPos <= 6 && netChange >= 0) changeType = 'top3_push';
    else if (previousPos !== null && previousPos <= 3 && (currentPos === null || currentPos > 3)) changeType = 'threshold_loss';
    else if (netChange < -5) changeType = 'hard_decline';
    else if (netChange < 0) changeType = 'soft_decline';

    return {
        ...record,
        valueScore,
        opportunityScore,
        riskScore,
        momentumScore,
        rankBand,
        changeType,
        currentPos,
        previousPos,
        netChange,
        avgPos,
    };
}

/**
 * Value tier bucketing used by the "valueTier" global filter.
 * High: valueScore >= 1000, Medium: 100-999, Low: < 100.
 */
export function getValueTier(valueScore: number): 'high' | 'medium' | 'low' {
    if (valueScore >= 1000) return 'high';
    if (valueScore >= 100) return 'medium';
    return 'low';
}

/**
 * Apply the shared GlobalFilterBar filter state (keywordSearch, rankBand,
 * valueTier, categoryTag, preset) to a list of scored keywords. This is the
 * single source of truth used by every parent view so the chart and the
 * table always render off the exact same filtered dataset.
 */
export function applyGlobalFilters(keywords: ScoredKeyword[], filters: FilterState): ScoredKeyword[] {
    let out = keywords;

    if (filters.keywordSearch) {
        const q = filters.keywordSearch.toLowerCase();
        out = out.filter(k => k.keyword.toLowerCase().includes(q));
    }

    if (filters.rankBand && filters.rankBand !== 'all') {
        out = out.filter(k => k.rankBand === filters.rankBand);
    }

    if (filters.categoryTag && filters.categoryTag !== 'all') {
        out = out.filter(k => k.tags.includes(filters.categoryTag));
    }

    if (filters.valueTier && filters.valueTier !== 'all') {
        out = out.filter(k => getValueTier(k.valueScore) === filters.valueTier);
    }

    switch (filters.preset) {
        case 'highest_value_opps':
            out = out.filter(k => k.opportunityScore > 0);
            break;
        case 'near_wins':
            out = out.filter(k => k.currentPos !== null && k.currentPos >= 4 && k.currentPos <= 15);
            break;
        case 'top3_push':
            out = out.filter(k => k.currentPos !== null && k.currentPos >= 4 && k.currentPos <= 7);
            break;
        case 'highest_value_declines':
            out = out.filter(k => k.netChange < 0);
            break;
        case 'first_page_drops':
            out = out.filter(k => k.previousPos !== null && k.previousPos <= 10 && (k.currentPos === null || k.currentPos > 10));
            break;
        default:
            break; // 'all' -- no preset filtering
    }

    return out;
}
