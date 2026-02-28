// Data Store porting backend logic to frontend store.

export interface KeywordRecord {
    keyword: string;
    tags: string[];
    volume: number;
    positions: Record<string, number | null>; // date -> position (null = not ranked)
    urlInSerp: string;
    expectedUrl: string;
}

export let KEYWORDS: KeywordRecord[] = [];
export let ALL_DATES: string[] = [];

export function clearData(): void {
    KEYWORDS = [];
    ALL_DATES = [];
    localStorage.removeItem('terra_seo_csv_cache');
}

export function loadFromCache(): boolean {
    const cached = localStorage.getItem('terra_seo_csv_cache');
    if (cached) {
        try {
            parseCSVContent(cached, false);
            return true;
        } catch (e) {
            console.warn('Failed parsing cached CSV', e);
            return false;
        }
    }
    return false;
}

export function parseCSVContent(raw: string, setCache = true): void {
    const lines = raw.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) {
        throw new Error('[CSV] File has no data rows');
    }

    const headerLine = lines[0];
    const headers = parseCSVLine(headerLine);

    const keywordIdx = headers.findIndex(h => h.trim().toLowerCase() === 'keywords');
    const tagIdx = headers.findIndex(h => h.trim().toLowerCase() === 'tags');
    const volIdx = headers.findIndex(h => h.trim().toLowerCase() === 'volume');

    const dateStartIdx = volIdx !== -1 ? volIdx + 1 : 4;
    const dateEndIdx = headers.length - 2;
    ALL_DATES = headers.slice(dateStartIdx, dateEndIdx);

    const newKeywords: KeywordRecord[] = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (cols.length < 5) continue;

        const keyword = keywordIdx !== -1 ? cols[keywordIdx]?.trim() || '' : cols[0]?.trim() || '';
        const tagsRaw = tagIdx !== -1 ? cols[tagIdx]?.trim() || '' : cols[1]?.trim() || '';
        const tags = tagsRaw.split(',').map(t => t.trim()).filter(t => t.length > 0);

        const volStr = (volIdx !== -1 ? cols[volIdx] : cols[3]) || '0';
        const volume = parseInt(volStr.replace(/,/g, '').trim()) || 0;

        const positions: Record<string, number | null> = {};
        for (let d = 0; d < ALL_DATES.length && (dateStartIdx + d) < cols.length; d++) {
            const val = cols[dateStartIdx + d]?.trim();
            if (!val || val === 'n/a' || val === '-' || val === '') {
                positions[ALL_DATES[d]] = null;
            } else {
                const num = parseInt(val);
                positions[ALL_DATES[d]] = isNaN(num) ? null : num;
            }
        }

        const urlInSerp = cols[cols.length - 2]?.trim() || '';
        const expectedUrl = cols[cols.length - 1]?.trim() || '';

        newKeywords.push({ keyword, tags, volume, positions, urlInSerp, expectedUrl });
    }

    KEYWORDS = newKeywords;

    if (setCache) {
        try {
            localStorage.setItem('terra_seo_csv_cache', raw);
        } catch (e) {
            console.warn('Could not cache CSV data: ', e);
        }
    }
}

function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current);
    return result;
}

export function getDataStatus() {
    return { loaded: KEYWORDS.length > 0, keywordCount: KEYWORDS.length };
}

export function getDataInfo() {
    const tagCounts: Record<string, { count: number, volume: number }> = {};
    KEYWORDS.forEach(kw => {
        kw.tags.forEach(tag => {
            if (!tagCounts[tag]) tagCounts[tag] = { count: 0, volume: 0 };
            tagCounts[tag].count += 1;
            tagCounts[tag].volume += (kw.volume || 0);
        });
    });

    return {
        totalKeywords: KEYWORDS.length,
        totalDates: ALL_DATES.length,
        dateRange: {
            from: ALL_DATES[ALL_DATES.length - 1],
            to: ALL_DATES[0]
        },
        tags: Object.entries(tagCounts)
            .sort((a, b) => b[1].volume - a[1].volume)
            .map(([tag, data]) => ({ tag, count: data.count, volume: data.volume })),
    };
}

export function getTags() {
    const tagCounts: Record<string, { count: number, volume: number }> = {};
    KEYWORDS.forEach(kw => {
        kw.tags.forEach(tag => {
            if (!tagCounts[tag]) tagCounts[tag] = { count: 0, volume: 0 };
            tagCounts[tag].count += 1;
            tagCounts[tag].volume += (kw.volume || 0);
        });
    });

    return Object.entries(tagCounts)
        .sort((a, b) => b[1].volume - a[1].volume)
        .map(([tag, data]) => ({ tag, count: data.count, volume: data.volume }));
}

interface KeywordMetrics {
    netChange: number;
    avgPos: string;
    bestPos: number;
    worstPos: number;
    slope: string;
    trend: 'improving' | 'declining' | 'flat' | 'no data';
    startPos: number | null;
    endPos: number | null;
    dataPoints: number;
}

function computeMetrics(record: KeywordRecord, dateFrom: string, dateTo: string): KeywordMetrics {
    const datesInRange = ALL_DATES
        .filter(d => d >= dateFrom && d <= dateTo)
        .sort();

    const values: { date: string; pos: number }[] = [];
    for (const d of datesInRange) {
        const pos = record.positions[d];
        if (pos !== null && pos !== undefined) {
            values.push({ date: d, pos });
        }
    }

    if (values.length === 0) {
        return {
            netChange: 0,
            avgPos: '-',
            bestPos: 0,
            worstPos: 0,
            slope: '0',
            trend: 'no data',
            startPos: null,
            endPos: null,
            dataPoints: 0,
        };
    }

    const positions = values.map(v => v.pos);
    const firstPos = positions[0];
    const lastPos = positions[positions.length - 1];
    const netChange = firstPos - lastPos;
    const avgPos = positions.reduce((a, b) => a + b, 0) / positions.length;
    const bestPos = Math.min(...positions);
    const worstPos = Math.max(...positions);

    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < positions.length; i++) {
        sumX += i;
        sumY += positions[i];
        sumXY += i * positions[i];
        sumXX += i * i;
    }
    const n = positions.length;
    const denominator = n * sumXX - sumX * sumX;
    const slope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;

    let trend: 'improving' | 'declining' | 'flat' = 'flat';
    if (slope < -0.1) trend = 'improving';
    else if (slope > 0.1) trend = 'declining';

    return {
        netChange,
        avgPos: avgPos.toFixed(1),
        bestPos,
        worstPos,
        slope: slope.toFixed(2),
        trend,
        startPos: firstPos,
        endPos: lastPos,
        dataPoints: positions.length,
    };
}

export function getPositionsHistory(query: any) {
    const dateFrom = query.date_from || ALL_DATES[ALL_DATES.length - 1];
    const dateTo = query.date_to || ALL_DATES[0];
    const tagFilter = query.tag || '';
    const keywordSearch = query.keyword_search || '';
    const page = Math.max(1, parseInt(query.page as any) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(query.limit as any) || 50));
    const sortBy = query.sort || 'volume';
    const order = query.order || 'desc';
    const filterType = query.filter_type || '';

    let filtered = KEYWORDS;

    if (tagFilter) {
        const tags = tagFilter.split(',').map((t: string) => t.trim().toLowerCase());
        filtered = filtered.filter(kw =>
            kw.tags.some(t => tags.includes(t.toLowerCase()))
        );
    }

    if (keywordSearch) {
        const search = keywordSearch.toLowerCase();
        filtered = filtered.filter(kw =>
            kw.keyword.toLowerCase().includes(search)
        );
    }

    let withMetrics = filtered.map(kw => {
        const metrics = computeMetrics(kw, dateFrom, dateTo);

        const datesInRange = ALL_DATES
            .filter(d => d >= dateFrom && d <= dateTo)
            .sort();

        const positions: Record<string, number | null> = {};
        datesInRange.forEach(d => {
            positions[d] = kw.positions[d] ?? null;
        });

        return {
            keyword: kw.keyword,
            tags: kw.tags,
            volume: kw.volume,
            urlInSerp: kw.urlInSerp,
            expectedUrl: kw.expectedUrl,
            metrics,
            positions,
        };
    });

    if (filterType === 'declines') {
        withMetrics = withMetrics.filter(kw => kw.metrics.netChange < 0);
    } else if (filterType === 'improvements') {
        withMetrics = withMetrics.filter(kw => kw.metrics.netChange > 0);
    } else if (filterType === 'first_page') {
        withMetrics = withMetrics.filter(kw => kw.metrics.endPos !== null && kw.metrics.endPos <= 10);
    } else if (filterType === 'top_3') {
        withMetrics = withMetrics.filter(kw => kw.metrics.endPos !== null && kw.metrics.endPos <= 3);
    }

    withMetrics.sort((a, b) => {
        let cmp = 0;
        switch (sortBy) {
            case 'netChange':
                cmp = Math.abs(b.metrics.netChange) - Math.abs(a.metrics.netChange);
                break;
            case 'volume':
                cmp = b.volume - a.volume;
                break;
            case 'avgPos':
                cmp = parseFloat(a.metrics.avgPos || '100') - parseFloat(b.metrics.avgPos || '100');
                break;
            case 'keyword':
                cmp = a.keyword.localeCompare(b.keyword);
                break;
            case 'bestPos':
                cmp = (a.metrics.bestPos || 100) - (b.metrics.bestPos || 100);
                break;
            default:
                cmp = b.volume - a.volume;
        }
        return order === 'asc' ? -cmp : cmp;
    });

    const total = withMetrics.length;
    const totalPages = Math.ceil(total / limit);
    const pageData = withMetrics.slice((page - 1) * limit, page * limit);

    const movers = { raised: 0, dropped: 0, unchanged: 0, noData: 0 };
    withMetrics.forEach(kw => {
        if (kw.metrics.trend === 'no data') movers.noData++;
        else if (kw.metrics.netChange > 0) movers.raised++;
        else if (kw.metrics.netChange < 0) movers.dropped++;
        else movers.unchanged++;
    });

    return {
        data: pageData,
        movers,
        pagination: {
            page,
            limit,
            total,
            totalPages,
        },
        dateRange: { from: dateFrom, to: dateTo },
    };
}

export function getTopMovers(query: any) {
    const dateFrom = query.date_from || ALL_DATES[ALL_DATES.length - 1];
    const dateTo = query.date_to || ALL_DATES[0];
    const direction = query.direction || 'all';
    const limit = Math.min(100, Math.max(1, parseInt(query.limit as any) || 20));

    const withMetrics = KEYWORDS
        .map(kw => ({
            keyword: kw.keyword,
            tags: kw.tags,
            volume: kw.volume,
            urlInSerp: kw.urlInSerp,
            metrics: computeMetrics(kw, dateFrom, dateTo),
        }))
        .filter(kw => kw.metrics.dataPoints > 1);

    let sorted: typeof withMetrics;
    if (direction === 'raised') {
        sorted = withMetrics.filter(kw => kw.metrics.netChange > 0)
            .sort((a, b) => b.metrics.netChange - a.metrics.netChange);
    } else if (direction === 'dropped') {
        sorted = withMetrics.filter(kw => kw.metrics.netChange < 0)
            .sort((a, b) => a.metrics.netChange - b.metrics.netChange);
    } else {
        sorted = withMetrics.sort((a, b) =>
            Math.abs(b.metrics.netChange) - Math.abs(a.metrics.netChange)
        );
    }

    return {
        data: sorted.slice(0, limit),
        dateRange: { from: dateFrom, to: dateTo },
    };
}

function getCTR(position: number): number {
    if (position <= 0 || position === null || isNaN(position)) return 0;
    const ctrMap: Record<number, number> = {
        1: 0.317, 2: 0.247, 3: 0.186, 4: 0.136, 5: 0.095,
        6: 0.062, 7: 0.042, 8: 0.031, 9: 0.026, 10: 0.023,
    };
    if (ctrMap[Math.round(position)]) return ctrMap[Math.round(position)];
    if (position <= 10) {
        const lower = Math.floor(position);
        const upper = Math.ceil(position);
        const lCTR = ctrMap[lower] || 0.023;
        const uCTR = ctrMap[upper] || 0.023;
        return lCTR + (uCTR - lCTR) * (position - lower);
    }
    if (position <= 20) return 0.01;
    if (position <= 50) return 0.002;
    return 0.0005;
}

interface ReportRecord {
    query: string;
    canonical_url: string;
    query_category: string[];
    volume: number;
    rank_last_3mo: number | null;
    rank_prev_3mo: number | null;
    clicks_last_3mo: number;
    clicks_prev_3mo: number;
    impressions_last_3mo: number;
    impressions_prev_3mo: number;
    click_delta: number;
    impressions_delta: number;
    rank_delta: number;
    positions_gained: number;
    trend_bucket: string;
    rank_movement: string;
    last_check_date: string | null;
}

function computeAvgRankForPeriod(record: KeywordRecord, dates: string[]): number | null {
    const vals: number[] = [];
    for (const d of dates) {
        const p = record.positions[d];
        if (p !== null && p !== undefined) vals.push(p);
    }
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function getLastCheckDate(record: KeywordRecord): string | null {
    const sortedDates = ALL_DATES.slice().sort(); // Chronological (oldest to newest)
    for (let i = sortedDates.length - 1; i >= 0; i--) {
        const d = sortedDates[i];
        if (record.positions[d] !== null && record.positions[d] !== undefined) return d;
    }
    return null;
}

function assignTrendBucket(clickDelta: number): string {
    if (clickDelta > 50) return 'Big Gain';
    if (clickDelta > 0) return 'Small Gain';
    if (clickDelta === 0) return 'Stable';
    if (clickDelta >= -50) return 'Small Loss';
    if (clickDelta >= -200) return 'Moderate Loss';
    return 'Big Loss';
}

function assignRankMovement(rankPrev: number | null, rankNow: number | null): string {
    if (rankPrev === null || rankNow === null) return 'No Change';
    if (rankPrev > 10 && rankNow <= 10) return 'Gained First Page';
    if (rankPrev <= 10 && rankNow > 10) return 'Lost First Page';
    if (rankNow < rankPrev) return 'Gained Rank';
    if (rankNow > rankPrev) return 'Lost Rank';
    return 'No Change';
}

function buildReportData(queryContains: string, urlContains: string, avgPosMax: number, lastCheckedDays: number): ReportRecord[] {
    const sortedDates = ALL_DATES.slice().sort(); // chronological
    const newestDate = sortedDates[sortedDates.length - 1];
    if (!newestDate) return [];

    const newestMs = new Date(newestDate).getTime();
    const day90Ms = 90 * 24 * 60 * 60 * 1000;

    const last3moStart = new Date(newestMs - day90Ms).toISOString().split('T')[0];
    const last3moEnd = newestDate;

    const prev3moStart = new Date(newestMs - 2 * day90Ms).toISOString().split('T')[0];
    const prev3moEnd = last3moStart;

    const last3moDates = sortedDates.filter(d => d >= last3moStart && d <= last3moEnd);
    const prev3moDates = sortedDates.filter(d => d >= prev3moStart && d < prev3moEnd);

    const lastCheckedCutoff = new Date(newestMs - lastCheckedDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const results: ReportRecord[] = [];

    for (const kw of KEYWORDS) {
        const lastCheck = getLastCheckDate(kw);
        if (!lastCheck || lastCheck < lastCheckedCutoff) continue;
        if (queryContains && !kw.keyword.toLowerCase().includes(queryContains.toLowerCase())) continue;
        if (urlContains && !kw.urlInSerp.toLowerCase().includes(urlContains.toLowerCase())) continue;

        const rankLast = computeAvgRankForPeriod(kw, last3moDates);
        const rankPrev = computeAvgRankForPeriod(kw, prev3moDates);

        if (rankLast !== null && rankLast > avgPosMax) continue;
        if (rankLast === null && rankPrev !== null && rankPrev > avgPosMax) continue;

        const clicksLast = rankLast !== null ? Math.round(kw.volume * getCTR(rankLast) * 3) : 0;
        const clicksPrev = rankPrev !== null ? Math.round(kw.volume * getCTR(rankPrev) * 3) : 0;

        const impressionsLast = rankLast !== null ? kw.volume * 3 : 0;
        const impressionsPrev = rankPrev !== null ? kw.volume * 3 : 0;

        const clickDelta = clicksLast - clicksPrev;
        const impressionsDelta = impressionsLast - impressionsPrev;
        const rankDelta = (rankLast !== null && rankPrev !== null) ? parseFloat((rankLast - rankPrev).toFixed(2)) : 0;
        const positionsGained = (rankPrev !== null && rankLast !== null) ? parseFloat((rankPrev - rankLast).toFixed(2)) : 0;

        results.push({
            query: kw.keyword,
            canonical_url: kw.urlInSerp,
            query_category: kw.tags,
            volume: kw.volume,
            rank_last_3mo: rankLast !== null ? parseFloat(rankLast.toFixed(1)) : null,
            rank_prev_3mo: rankPrev !== null ? parseFloat(rankPrev.toFixed(1)) : null,
            clicks_last_3mo: clicksLast,
            clicks_prev_3mo: clicksPrev,
            impressions_last_3mo: impressionsLast,
            impressions_prev_3mo: impressionsPrev,
            click_delta: clickDelta,
            impressions_delta: impressionsDelta,
            rank_delta: rankDelta,
            positions_gained: positionsGained,
            trend_bucket: assignTrendBucket(clickDelta),
            rank_movement: assignRankMovement(rankPrev, rankLast),
            last_check_date: lastCheck,
        });
    }

    return results;
}

export function getSeoReport(query: any) {
    const queryContains = query.queryContains || '';
    const urlContains = query.urlContains || '';
    const avgPosMax = parseFloat(query.avg_position_max) || 200;
    const lastCheckedDays = parseInt(query.last_checked_days) || 30;

    const records = buildReportData(queryContains, urlContains, avgPosMax, lastCheckedDays);

    const totalClicksLast = records.reduce((s, r) => s + r.clicks_last_3mo, 0);
    const totalClicksPrev = records.reduce((s, r) => s + r.clicks_prev_3mo, 0);
    const clickDelta = totalClicksLast - totalClicksPrev;

    const rankedLast = records.filter(r => r.rank_last_3mo !== null);
    const rankedPrev = records.filter(r => r.rank_prev_3mo !== null);
    const avgRankNow = rankedLast.length > 0
        ? parseFloat((rankedLast.reduce((s, r) => s + r.rank_last_3mo!, 0) / rankedLast.length).toFixed(1))
        : 0;
    const avgRankWas = rankedPrev.length > 0
        ? parseFloat((rankedPrev.reduce((s, r) => s + r.rank_prev_3mo!, 0) / rankedPrev.length).toFixed(1))
        : 0;
    const rankDelta = parseFloat((avgRankNow - avgRankWas).toFixed(2));

    const trendBuckets: Record<string, { clickDelta: number; rankNowSum: number; rankWasSum: number; rankNowCount: number; rankWasCount: number; count: number }> = {};
    const bucketOrder = ['Big Gain', 'Small Gain', 'Stable', 'Small Loss', 'Moderate Loss', 'Big Loss'];
    bucketOrder.forEach(b => { trendBuckets[b] = { clickDelta: 0, rankNowSum: 0, rankWasSum: 0, rankNowCount: 0, rankWasCount: 0, count: 0 }; });

    records.forEach(r => {
        const b = trendBuckets[r.trend_bucket];
        if (!b) return;
        b.clickDelta += r.click_delta;
        b.count++;
        if (r.rank_last_3mo !== null) { b.rankNowSum += r.rank_last_3mo; b.rankNowCount++; }
        if (r.rank_prev_3mo !== null) { b.rankWasSum += r.rank_prev_3mo; b.rankWasCount++; }
    });

    const trends = bucketOrder.map(name => ({
        trend: name,
        click_delta: trendBuckets[name].clickDelta,
        rank_now: trendBuckets[name].rankNowCount > 0 ? parseFloat((trendBuckets[name].rankNowSum / trendBuckets[name].rankNowCount).toFixed(1)) : null,
        rank_was: trendBuckets[name].rankWasCount > 0 ? parseFloat((trendBuckets[name].rankWasSum / trendBuckets[name].rankWasCount).toFixed(1)) : null,
        count: trendBuckets[name].count,
    }));

    const clickDeclines = records
        .filter(r => r.click_delta < 0)
        .sort((a, b) => a.click_delta - b.click_delta)
        .map(r => ({
            query: r.query,
            click_delta: r.click_delta,
            impressions_delta: r.impressions_delta,
            rank_delta: r.rank_delta,
            rank_was: r.rank_prev_3mo,
            rank_now: r.rank_last_3mo,
        }));

    const clickGains = records
        .filter(r => r.click_delta > 0)
        .sort((a, b) => b.click_delta - a.click_delta)
        .map(r => ({
            query: r.query,
            click_delta: r.click_delta,
            positions_gained: r.positions_gained,
            impressions_delta: r.impressions_delta,
            rank_was: r.rank_prev_3mo,
            rank_now: r.rank_last_3mo,
        }));

    const queryUrlCombined = records
        .filter(r => r.click_delta !== 0)
        .sort((a, b) => Math.abs(b.click_delta) - Math.abs(a.click_delta))
        .map(r => ({
            canonical_url: r.canonical_url,
            query: r.query,
            click_delta: r.click_delta,
            impressions_delta: r.impressions_delta,
            rank_delta: r.rank_delta,
            rank_was: r.rank_prev_3mo,
            rank_now: r.rank_last_3mo,
        }));

    const movementCategories = ['Gained First Page', 'Lost First Page', 'Gained Rank', 'Lost Rank', 'No Change'];
    const rankTrendsVisual = movementCategories.map(cat => ({
        category: cat,
        clicks_delta: records.filter(r => r.rank_movement === cat).reduce((s, r) => s + r.click_delta, 0),
        count: records.filter(r => r.rank_movement === cat).length,
    }));

    const catMap: Record<string, { clicksDelta: number; rankLastSum: number; rankPrevSum: number; rankLastCount: number; rankPrevCount: number; count: number }> = {};
    records.forEach(r => {
        const cats = r.query_category.length > 0 ? r.query_category : ['Other'];
        cats.forEach(cat => {
            if (!catMap[cat]) catMap[cat] = { clicksDelta: 0, rankLastSum: 0, rankPrevSum: 0, rankLastCount: 0, rankPrevCount: 0, count: 0 };
            const c = catMap[cat];
            c.clicksDelta += r.click_delta;
            c.count++;
            if (r.rank_last_3mo !== null) { c.rankLastSum += r.rank_last_3mo; c.rankLastCount++; }
            if (r.rank_prev_3mo !== null) { c.rankPrevSum += r.rank_prev_3mo; c.rankPrevCount++; }
        });
    });

    const categoryTrends = Object.entries(catMap)
        .map(([category, data]) => ({
            query_category: category,
            clicks_delta_3mo: data.clicksDelta,
            rank_last_3mo: data.rankLastCount > 0 ? parseFloat((data.rankLastSum / data.rankLastCount).toFixed(1)) : null,
            rank_prev_3mo: data.rankPrevCount > 0 ? parseFloat((data.rankPrevSum / data.rankPrevCount).toFixed(1)) : null,
            count: data.count,
        }))
        .sort((a, b) => Math.abs(b.clicks_delta_3mo) - Math.abs(a.clicks_delta_3mo));

    const declinesTotal = {
        click_delta: clickDeclines.reduce((s, r) => s + r.click_delta, 0),
        impressions_delta: clickDeclines.reduce((s, r) => s + r.impressions_delta, 0),
        rank_delta: clickDeclines.length > 0 ? parseFloat((clickDeclines.reduce((s, r) => s + r.rank_delta, 0) / clickDeclines.length).toFixed(2)) : 0,
        rank_was: clickDeclines.filter(r => r.rank_was !== null).length > 0
            ? parseFloat((clickDeclines.filter(r => r.rank_was !== null).reduce((s, r) => s + r.rank_was!, 0) / clickDeclines.filter(r => r.rank_was !== null).length).toFixed(1))
            : null,
        rank_now: clickDeclines.filter(r => r.rank_now !== null).length > 0
            ? parseFloat((clickDeclines.filter(r => r.rank_now !== null).reduce((s, r) => s + r.rank_now!, 0) / clickDeclines.filter(r => r.rank_now !== null).length).toFixed(1))
            : null,
        count: clickDeclines.length,
    };

    const gainsTotal = {
        click_delta: clickGains.reduce((s, r) => s + r.click_delta, 0),
        positions_gained: clickGains.length > 0 ? parseFloat((clickGains.reduce((s, r) => s + r.positions_gained, 0) / clickGains.length).toFixed(2)) : 0,
        impressions_delta: clickGains.reduce((s, r) => s + r.impressions_delta, 0),
        rank_was: clickGains.filter(r => r.rank_was !== null).length > 0
            ? parseFloat((clickGains.filter(r => r.rank_was !== null).reduce((s, r) => s + r.rank_was!, 0) / clickGains.filter(r => r.rank_was !== null).length).toFixed(1))
            : null,
        rank_now: clickGains.filter(r => r.rank_now !== null).length > 0
            ? parseFloat((clickGains.filter(r => r.rank_now !== null).reduce((s, r) => s + r.rank_now!, 0) / clickGains.filter(r => r.rank_now !== null).length).toFixed(1))
            : null,
        count: clickGains.length,
    };

    const combinedTotal = {
        click_delta: queryUrlCombined.reduce((s, r) => s + r.click_delta, 0),
        impressions_delta: queryUrlCombined.reduce((s, r) => s + r.impressions_delta, 0),
        rank_delta: queryUrlCombined.length > 0 ? parseFloat((queryUrlCombined.reduce((s, r) => s + r.rank_delta, 0) / queryUrlCombined.length).toFixed(2)) : 0,
        rank_was: queryUrlCombined.filter(r => r.rank_was !== null).length > 0
            ? parseFloat((queryUrlCombined.filter(r => r.rank_was !== null).reduce((s, r) => s + r.rank_was!, 0) / queryUrlCombined.filter(r => r.rank_was !== null).length).toFixed(1))
            : null,
        rank_now: queryUrlCombined.filter(r => r.rank_now !== null).length > 0
            ? parseFloat((queryUrlCombined.filter(r => r.rank_now !== null).reduce((s, r) => s + r.rank_now!, 0) / queryUrlCombined.filter(r => r.rank_now !== null).length).toFixed(1))
            : null,
        count: queryUrlCombined.length,
    };

    return {
        topMetrics: {
            click_delta: clickDelta,
            clicks_last_3mo: totalClicksLast,
            clicks_prev_3mo: totalClicksPrev,
            rank_delta: rankDelta,
            avg_rank_was: avgRankWas,
            avg_rank_now: avgRankNow,
            total_records: records.length,
        },
        trends,
        clickDeclines: clickDeclines.slice(0, 200),
        clickGains: clickGains.slice(0, 200),
        queryUrlCombined: queryUrlCombined.slice(0, 200),
        rankTrendsVisual,
        categoryTrends,
        declinesTotal,
        gainsTotal,
        combinedTotal,
    };
}

export function getTagSummary(query: any) {
    const dateFrom = query.date_from || ALL_DATES[ALL_DATES.length - 1];
    const dateTo = query.date_to || ALL_DATES[0];

    const tagGroups: Record<string, {
        keywords: number;
        totalVolume: number;
        avgPositions: number[];
        raised: number;
        dropped: number;
        unchanged: number;
    }> = {};

    KEYWORDS.forEach(kw => {
        const metrics = computeMetrics(kw, dateFrom, dateTo);
        kw.tags.forEach(tag => {
            if (!tagGroups[tag]) {
                tagGroups[tag] = {
                    keywords: 0,
                    totalVolume: 0,
                    avgPositions: [],
                    raised: 0,
                    dropped: 0,
                    unchanged: 0,
                };
            }
            const g = tagGroups[tag];
            g.keywords++;
            g.totalVolume += kw.volume;
            if (metrics.avgPos !== '-') g.avgPositions.push(parseFloat(metrics.avgPos));
            if (metrics.netChange > 0) g.raised++;
            else if (metrics.netChange < 0) g.dropped++;
            else g.unchanged++;
        });
    });

    const result = Object.entries(tagGroups)
        .map(([tag, data]) => ({
            tag,
            keywords: data.keywords,
            totalVolume: data.totalVolume,
            avgPosition: data.avgPositions.length > 0
                ? (data.avgPositions.reduce((a, b) => a + b, 0) / data.avgPositions.length).toFixed(1)
                : '-',
            raised: data.raised,
            dropped: data.dropped,
            unchanged: data.unchanged,
        }))
        .sort((a, b) => b.totalVolume - a.totalVolume);

    return {
        data: result,
        dateRange: { from: dateFrom, to: dateTo },
    };
}
