import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import axios from 'axios';
import { listProjects, fetchPositionsHistory, discoverTools } from './serpstatMcp';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

// Serve frontend static files in production
const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));

// ---------------------------------------------------------------------------
// CSV Data Layer
// ---------------------------------------------------------------------------

interface KeywordRecord {
    keyword: string;
    tags: string[];
    volume: number;
    positions: Record<string, number | null>; // date -> position (null = not ranked)
    urlInSerp: string;
    expectedUrl: string;
}

let KEYWORDS: KeywordRecord[] = [];
let ALL_DATES: string[] = [];

function parseCSVContent(raw: string): void {
    const lines = raw.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) {
        throw new Error('[CSV] File has no data rows');
    }

    const headerLine = lines[0];
    // Remove BOM if present
    const cleanHeaderLine = headerLine.replace(/^\uFEFF/, '');
    const headers = parseCSVLine(cleanHeaderLine);

    const keywordIdx = 0; // Usually first column

    let tagsIdx = headers.findIndex(h => {
        const lower = h.toLowerCase();
        return lower.includes('tag') || lower.includes('?rrmn');
    });

    let searchRegionsIdx = headers.findIndex(h => h.toLowerCase().includes('search region'));
    let volumeIdx = headers.findIndex(h => h.toLowerCase().includes('volume'));
    let urlInSerpIdx = headers.findIndex(h => h.toLowerCase().includes('url in serp'));
    let expectedUrlIdx = headers.findIndex(h => h.toLowerCase().includes('expected url'));

    // Fallbacks
    if (tagsIdx === -1) tagsIdx = 1;
    if (volumeIdx === -1) {
        if (searchRegionsIdx !== -1) volumeIdx = searchRegionsIdx + 1;
        else volumeIdx = 2;
    }

    const dateColumns: { name: string, idx: number }[] = [];

    for (let i = 0; i < headers.length; i++) {
        if (i === keywordIdx || i === tagsIdx || i === searchRegionsIdx || i === volumeIdx || i === urlInSerpIdx || i === expectedUrlIdx) {
            continue;
        }

        const h = headers[i].trim();
        if (!h) continue;

        // Check if it's a date standard format First YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(h)) {
            dateColumns.push({ name: h, idx: i });
        } else {
            // Try JS Date parsing
            // Also requires avoiding purely numeric column headers that aren't dates
            // But usually Serpstat headers that are left over are dates.
            const d = new Date(h);
            if (!isNaN(d.getTime())) {
                const formatted = d.toISOString().split('T')[0];
                dateColumns.push({ name: formatted, idx: i });
            }
        }
    }

    ALL_DATES = Array.from(new Set(dateColumns.map(dc => dc.name))).sort().reverse();

    const oldest = ALL_DATES.length > 0 ? ALL_DATES[ALL_DATES.length - 1] : 'none';
    const newest = ALL_DATES.length > 0 ? ALL_DATES[0] : 'none';
    console.log(`[CSV] Found ${ALL_DATES.length} date columns, from ${oldest} to ${newest}`);

    // Parse data rows
    const newKeywords: KeywordRecord[] = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (cols.length < Math.max(keywordIdx, tagsIdx, volumeIdx)) continue;

        const keyword = cols[keywordIdx]?.trim() || '';
        const tagsRaw = cols[tagsIdx]?.trim() || '';
        const tags = tagsRaw.split(',').map(t => t.trim()).filter(t => t.length > 0);

        let volume = 0;
        if (volumeIdx !== -1 && cols[volumeIdx]) {
            const volStr = cols[volumeIdx].replace(/,/g, '');
            volume = parseInt(volStr) || 0;
        }

        const positions: Record<string, number | null> = {};
        for (const dc of dateColumns) {
            const val = cols[dc.idx]?.trim();
            if (!val || val === 'n/a' || val === '-' || val === '') {
                positions[dc.name] = null;
            } else {
                const num = parseInt(val);
                positions[dc.name] = isNaN(num) ? null : num;
            }
        }

        const urlInSerp = urlInSerpIdx !== -1 ? (cols[urlInSerpIdx]?.trim() || '') : '';
        const expectedUrl = expectedUrlIdx !== -1 ? (cols[expectedUrlIdx]?.trim() || '') : '';

        newKeywords.push({ keyword, tags, volume, positions, urlInSerp, expectedUrl });
    }

    KEYWORDS = newKeywords;
    console.log(`[CSV] Loaded ${KEYWORDS.length} keywords`);
}

// Startup file load removed per requirement

/** Simple CSV line parser that handles quoted fields with commas */
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

// No local persistence, wait for web upload

// ---------------------------------------------------------------------------
// File Upload Handlers (Local File / Google Sheet URL)
// ---------------------------------------------------------------------------

app.get('/api/data-status', (_req, res) => {
    res.json({ loaded: KEYWORDS.length > 0, keywordCount: KEYWORDS.length });
});

app.post('/api/clear-data', (_req, res) => {
    KEYWORDS = [];
    ALL_DATES = [];
    console.log('[CSV] Data cleared by client request');
    res.json({ success: true });
});

app.post('/api/upload-csv', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    try {
        const raw = fs.readFileSync(req.file.path, 'utf-8');
        parseCSVContent(raw);



        res.json({ success: true, count: KEYWORDS.length });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    } finally {
        fs.unlinkSync(req.file.path);
    }
});

app.post('/api/upload-csv-url', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        // If it's a standard Google Sheets URL, convert it to CSV export link format automatically
        let fetchUrl = url;
        if (url.includes('docs.google.com/spreadsheets')) {
            const matches = url.match(/\/d\/(.*?)(\/|$)/);
            if (matches && matches[1]) {
                fetchUrl = `https://docs.google.com/spreadsheets/d/${matches[1]}/export?format=csv`;
            }
        }

        const response = await axios.get(fetchUrl);
        const raw = response.data;
        parseCSVContent(raw);



        res.json({ success: true, count: KEYWORDS.length });
    } catch (e: any) {
        res.status(500).json({ error: typeof e.response?.data === 'string' ? e.response.data : e.message });
    }
});

// ---------------------------------------------------------------------------
// Serpstat MCP Integration
// ---------------------------------------------------------------------------

function getSerpstatToken(): string | null {
    return process.env.SERPSTAT_API_TOKEN || null;
}

// Check if a Serpstat token is configured
app.get('/api/serpstat/status', (_req, res) => {
    const token = getSerpstatToken();
    res.json({ configured: !!token && token !== 'your_serpstat_api_token_here' });
});

// List rank tracker projects
app.get('/api/serpstat/projects', async (_req, res) => {
    try {
        const token = getSerpstatToken();
        if (!token || token === 'your_serpstat_api_token_here') {
            return res.status(400).json({ error: 'SERPSTAT_API_TOKEN not configured in .env' });
        }
        const projects = await listProjects(token);
        res.json({ projects });
    } catch (e: any) {
        console.error('[Serpstat] Error listing projects:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Discover available MCP tools (for debugging)
app.get('/api/serpstat/tools', async (_req, res) => {
    try {
        const token = getSerpstatToken();
        if (!token || token === 'your_serpstat_api_token_here') {
            return res.status(400).json({ error: 'SERPSTAT_API_TOKEN not configured in .env' });
        }
        const tools = await discoverTools(token);
        res.json({ tools, count: tools.length });
    } catch (e: any) {
        console.error('[Serpstat] Error discovering tools:', e.message);
        res.status(500).json({ error: e.message });
    }
});

/**
 * Transform Serpstat positions history data into our KeywordRecord format.
 * The exact shape depends on what the MCP returns, so we handle multiple formats.
 */
function transformSerpstatData(rawData: any): void {
    const records: any[] = Array.isArray(rawData)
        ? rawData
        : (rawData?.data || rawData?.keywords || rawData?.results || [rawData]);

    if (!records || records.length === 0) {
        throw new Error('No keyword data returned from Serpstat');
    }

    // Collect all unique dates across all records
    const dateSet = new Set<string>();
    const newKeywords: KeywordRecord[] = [];

    for (const rec of records) {
        // Extract keyword name (try multiple field names)
        const keyword = rec.keyword || rec.query || rec.name || rec.phrase || '';
        if (!keyword) continue;

        // Extract tags/categories
        const tagsRaw = rec.tags || rec.categories || rec.tag || '';
        const tags: string[] = Array.isArray(tagsRaw)
            ? tagsRaw.map((t: any) => String(t).trim()).filter((t: string) => t.length > 0)
            : String(tagsRaw).split(',').map(t => t.trim()).filter(t => t.length > 0);

        // Extract volume
        const volume = parseInt(String(rec.volume || rec.search_volume || rec.cost || 0)) || 0;

        // Extract positions history
        const positions: Record<string, number | null> = {};
        const posHistory = rec.positions || rec.position_history || rec.history || rec.serp_history || {};

        if (typeof posHistory === 'object' && !Array.isArray(posHistory)) {
            // Object format: { "2026-02-15": 5, "2026-02-20": 3, ... }
            for (const [date, pos] of Object.entries(posHistory)) {
                const normalizedDate = normalizeDate(date);
                if (normalizedDate) {
                    dateSet.add(normalizedDate);
                    const numPos = Number(pos);
                    positions[normalizedDate] = isNaN(numPos) ? null : numPos;
                }
            }
        } else if (Array.isArray(posHistory)) {
            // Array format: [{ date: "2026-02-15", position: 5 }, ...]
            for (const entry of posHistory) {
                const date = normalizeDate(entry.date || entry.check_date || entry.created_at || '');
                const pos = entry.position ?? entry.pos ?? entry.rank ?? null;
                if (date) {
                    dateSet.add(date);
                    positions[date] = pos !== null ? Number(pos) : null;
                }
            }
        }

        // Extract URLs
        const urlInSerp = rec.url || rec.found_url || rec.serp_url || '';
        const expectedUrl = rec.expected_url || rec.target_url || '';

        newKeywords.push({ keyword, tags, volume, positions, urlInSerp, expectedUrl });
    }

    if (newKeywords.length === 0) {
        throw new Error('Could not parse any keywords from Serpstat response');
    }

    // Sort dates newest first (matching CSV convention)
    ALL_DATES = Array.from(dateSet).sort((a, b) => b.localeCompare(a));
    KEYWORDS = newKeywords;

    console.log(`[Serpstat] Loaded ${KEYWORDS.length} keywords across ${ALL_DATES.length} dates`);
}

/**
 * Normalize various date formats to YYYY-MM-DD.
 */
function normalizeDate(raw: string): string | null {
    if (!raw) return null;
    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    // ISO string
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
}

// Fetch positions history from Serpstat and load into memory
app.post('/api/fetch-serpstat', async (req, res) => {
    try {
        const token = getSerpstatToken();
        if (!token || token === 'your_serpstat_api_token_here') {
            return res.status(400).json({ error: 'SERPSTAT_API_TOKEN not configured in .env' });
        }

        const { projectId, regionId } = req.body;
        if (!projectId) {
            return res.status(400).json({ error: 'projectId is required' });
        }

        console.log(`[Serpstat] Fetching positions history for project ${projectId}...`);
        const rawData = await fetchPositionsHistory(token, projectId, regionId);

        // Transform and load data
        transformSerpstatData(rawData);

        res.json({
            success: true,
            count: KEYWORDS.length,
            dates: ALL_DATES.length,
            keywords: KEYWORDS,
            allDates: ALL_DATES,
            source: 'serpstat_mcp',
        });
    } catch (e: any) {
        console.error('[Serpstat] Error fetching data:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ---------------------------------------------------------------------------
// Utility: compute metrics for a keyword within a date range
// ---------------------------------------------------------------------------

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
    // Get positions within the date range, sorted chronologically (oldest first)
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
    // For SEO, lower position number = better. Net change positive = improved.
    const netChange = firstPos - lastPos;
    const avgPos = positions.reduce((a, b) => a + b, 0) / positions.length;
    const bestPos = Math.min(...positions);
    const worstPos = Math.max(...positions);

    // Linear regression for trend
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

    // Negative slope = position number decreasing = improving in rank
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

// ---------------------------------------------------------------------------
// CTR Curve: Estimate click-through rate from SERP position
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// SEO Report: 90-day comparison + CTR-estimated clicks
// ---------------------------------------------------------------------------

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
    // ALL_DATES is sorted newest-first
    for (const d of ALL_DATES) {
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
    const prev = rankPrev === null ? 100 : rankPrev;
    const now = rankNow === null ? 100 : rankNow;

    if (prev === now) return 'No Change';
    if (prev > 10 && now <= 10) return 'Gained First Page';
    if (prev <= 10 && now > 10) return 'Lost First Page';
    if (now < prev) return 'Gained Rank';
    if (now > prev) return 'Lost Rank';
    return 'No Change';
}

function buildReportData(queryContains: string, urlContains: string, avgPosMax: number, lastCheckedDays: number): ReportRecord[] {
    // Determine the 90-day periods based on the most recent date in the dataset
    const sortedDates = [...ALL_DATES].sort(); // chronological
    if (sortedDates.length === 0) return [];

    // Grab the newest available date
    const newestDate = sortedDates[sortedDates.length - 1];
    const newestMs = new Date(newestDate).getTime();
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

    // Define Last 3 Months strictly as the 90 days relative to the dataset's newest anchor point
    const last3moDates = sortedDates.filter(d => new Date(d).getTime() > newestMs - ninetyDaysMs);

    // Initial definition for Previous 3 Months is the 90 days before that
    let prev3moDates = sortedDates.filter(d => {
        const t = new Date(d).getTime();
        return t <= newestMs - ninetyDaysMs && t > newestMs - ninetyDaysMs * 2;
    });

    // RESILIENCY MEASURE: If a massive data gap (like the 6.5 month leap) caused `prev3moDates` to be completely empty, 
    // dynamically locate the next most recent block's anchor and build a functional 90-day baseline window from it.
    if (prev3moDates.length === 0 && sortedDates.length > last3moDates.length) {
        const prevBlockNewestDate = sortedDates[sortedDates.length - last3moDates.length - 1];
        const prevBlockNewestMs = new Date(prevBlockNewestDate).getTime();

        prev3moDates = sortedDates.filter(d => {
            const t = new Date(d).getTime();
            return t <= prevBlockNewestMs && t > prevBlockNewestMs - ninetyDaysMs;
        });
    }

    // Last checked cutoff - keep time based to drop absolutely dead keywords
    const lastCheckedCutoff = new Date(newestMs - lastCheckedDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const results: ReportRecord[] = [];

    for (const kw of KEYWORDS) {
        // Filter: last checked rank must be within lastCheckedDays
        const lastCheck = getLastCheckDate(kw);
        if (!lastCheck || lastCheck < lastCheckedCutoff) continue;

        // Filter: query contains
        if (queryContains && !kw.keyword.toLowerCase().includes(queryContains.toLowerCase())) continue;

        // Filter: URL contains
        if (urlContains && !kw.urlInSerp.toLowerCase().includes(urlContains.toLowerCase())) continue;

        const rankLast = computeAvgRankForPeriod(kw, last3moDates);
        const rankPrev = computeAvgRankForPeriod(kw, prev3moDates);

        // Filter: avg position max
        if (rankLast !== null && rankLast > avgPosMax) continue;
        if (rankLast === null && rankPrev !== null && rankPrev > avgPosMax) continue;

        // CTR-estimated clicks = volume * CTR(rank) * 3 months
        const clicksLast = rankLast !== null ? Math.round(kw.volume * getCTR(rankLast) * 3) : 0;
        const clicksPrev = rankPrev !== null ? Math.round(kw.volume * getCTR(rankPrev) * 3) : 0;

        // Impressions estimate: volume * 3 months (assumes one full cycle per month)
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

// GET /api/seo-report
//   ?queryContains=&urlContains=&avg_position_max=200&last_checked_days=30
app.get('/api/seo-report', (req, res) => {
    try {
        const queryContains = (req.query.queryContains as string) || '';
        const urlContains = (req.query.urlContains as string) || '';
        const avgPosMax = parseFloat(req.query.avg_position_max as string) || 200;
        const lastCheckedDays = parseInt(req.query.last_checked_days as string) || 30;

        const records = buildReportData(queryContains, urlContains, avgPosMax, lastCheckedDays);

        // Top metrics
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

        // Trend buckets aggregation
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

        // Click Declines (negative click delta, sorted by most loss)
        const clickDeclines = records
            .filter(r => r.click_delta < 0)
            .sort((a, b) => a.click_delta - b.click_delta)
            .map(r => ({
                query: r.query,
                volume: r.volume,
                click_delta: r.click_delta,
                impressions_delta: r.impressions_delta,
                rank_delta: r.rank_delta,
                rank_was: r.rank_prev_3mo,
                rank_now: r.rank_last_3mo,
            }));

        // Click Gains (positive click delta, sorted by most gain)
        const clickGains = records
            .filter(r => r.click_delta > 0)
            .sort((a, b) => b.click_delta - a.click_delta)
            .map(r => ({
                query: r.query,
                volume: r.volume,
                click_delta: r.click_delta,
                positions_gained: r.positions_gained,
                impressions_delta: r.impressions_delta,
                rank_was: r.rank_prev_3mo,
                rank_now: r.rank_last_3mo,
            }));

        // Query x URL combined (excluding zero click change)
        const queryUrlCombined = records
            .filter(r => r.click_delta !== 0)
            .sort((a, b) => Math.abs(b.click_delta) - Math.abs(a.click_delta))
            .map(r => ({
                canonical_url: r.canonical_url,
                query: r.query,
                volume: r.volume,
                click_delta: r.click_delta,
                impressions_delta: r.impressions_delta,
                rank_delta: r.rank_delta,
                rank_was: r.rank_prev_3mo,
                rank_now: r.rank_last_3mo,
            }));

        // Rank Trends Visual (aggregated by rank movement category)
        const movementCategories = ['Gained First Page', 'Lost First Page', 'Gained Rank', 'Lost Rank', 'No Change'];
        const rankTrendsVisual = movementCategories.map(cat => ({
            category: cat,
            clicks_delta: records.filter(r => r.rank_movement === cat).reduce((s, r) => s + r.click_delta, 0),
            count: records.filter(r => r.rank_movement === cat).length,
        }));

        // Category Trends (by query_category / tags)
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

        // Compute grand totals for declines/gains
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

        res.json({
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
        });
    } catch (error: any) {
        console.error('[seo-report error]', error);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// High Impact Items API
// ---------------------------------------------------------------------------

app.get('/api/high-impact-items', (req, res) => {
    try {
        if (ALL_DATES.length === 0) return res.json([]);
        const newestDate = ALL_DATES[0];

        // Find date closest to 90 days ago
        const newestMs = new Date(newestDate).getTime();
        const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
        let prev90Date = ALL_DATES[ALL_DATES.length - 1];
        let minDiff = Infinity;
        for (const d of ALL_DATES) {
            const diff = Math.abs(new Date(d).getTime() - (newestMs - ninetyDaysMs));
            if (diff < minDiff) {
                minDiff = diff;
                prev90Date = d;
            }
        }

        const items = KEYWORDS.map(kw => {
            const currentRank = kw.positions[newestDate];
            const prevRank = kw.positions[prev90Date];

            const validHistory = ALL_DATES.map(d => kw.positions[d]).filter((v): v is number => v !== null && v !== undefined && !Number.isNaN(v) && v !== 0);

            let histAvg: number | null = null;
            let histMin: number | null = null;
            let histMax: number | null = null;

            if (validHistory.length > 0) {
                histAvg = parseFloat((validHistory.reduce((a, b) => a + b, 0) / validHistory.length).toFixed(2));
                histMin = Math.min(...validHistory);
                histMax = Math.round(Math.max(...validHistory));
            }

            let visibilityLoss = '';
            if (prevRank !== null && prevRank !== undefined && currentRank !== null && currentRank !== undefined) {
                if (prevRank <= 5 && currentRank >= 6) visibilityLoss = 'Lost Top 5';
                else if (prevRank <= 10 && currentRank >= 11) visibilityLoss = 'Lost Top 10';
            }

            let powerScore: number | null = null;
            if (kw.keyword?.trim() !== '') {
                if (kw.volume <= 0) {
                    powerScore = 0;
                } else if (currentRank !== null && currentRank !== undefined) {
                    const logVolume = Math.log10(kw.volume);
                    const multiplier = currentRank < 11 ? 10 : (21 - currentRank);
                    powerScore = parseFloat((logVolume * multiplier).toFixed(2));
                }
            }

            let impactScore = 0;
            if (currentRank !== null && currentRank !== undefined && currentRank < 11 && kw.volume > 0) {
                // greatest impact: highest volume + lowest rank
                impactScore = parseFloat((kw.volume / currentRank).toFixed(2));
            }

            return {
                keyword: kw.keyword,
                volume: kw.volume,
                currentRank,
                previous90dRank: prevRank,
                visibilityLoss,
                powerScore,
                impactScore,
                histAvg,
                histMin,
                histMax,
                impactImproved: kw.volume > 0 && powerScore !== null && powerScore > 20 ? 'High Impact' : '',
                lowVolume: kw.volume === 0 ? 'Low Search Volume' : '',
            };
        });

        // Top N inspection requirement based on impact score
        items.sort((a, b) => b.impactScore - a.impactScore);

        const finalItems = items.map((item, idx) => ({
            ...item,
            inspectionRequired: idx < 50 && item.impactScore > 0
        }));

        res.json(finalItems);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// ---------------------------------------------------------------------------
// API Endpoints
// ---------------------------------------------------------------------------

// GET /api/data-info  - summary about the loaded dataset
app.get('/api/data-info', (_req, res) => {
    const tagCounts: Record<string, { count: number, volume: number }> = {};
    KEYWORDS.forEach(kw => {
        kw.tags.forEach(tag => {
            if (!tagCounts[tag]) tagCounts[tag] = { count: 0, volume: 0 };
            tagCounts[tag].count += 1;
            tagCounts[tag].volume += (kw.volume || 0);
        });
    });

    res.json({
        totalKeywords: KEYWORDS.length,
        totalDates: ALL_DATES.length,
        dateRange: {
            from: ALL_DATES[ALL_DATES.length - 1],
            to: ALL_DATES[0]
        },
        tags: Object.entries(tagCounts)
            .sort((a, b) => b[1].volume - a[1].volume) // Sort by volume initially to prioritize high value
            .map(([tag, data]) => ({ tag, count: data.count, volume: data.volume })),
    });
});

// GET /api/tags - list all unique tags with counts
app.get('/api/tags', (_req, res) => {
    const tagCounts: Record<string, { count: number, volume: number }> = {};
    KEYWORDS.forEach(kw => {
        kw.tags.forEach(tag => {
            if (!tagCounts[tag]) tagCounts[tag] = { count: 0, volume: 0 };
            tagCounts[tag].count += 1;
            tagCounts[tag].volume += (kw.volume || 0);
        });
    });

    res.json(
        Object.entries(tagCounts)
            .sort((a, b) => b[1].volume - a[1].volume)
            .map(([tag, data]) => ({ tag, count: data.count, volume: data.volume }))
    );
});

// GET /api/positions-history
//   ?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
//   &tag=<tag-filter>
//   &keyword_search=<search-string>
//   &page=1&limit=50
//   &sort=netChange|volume|avgPos|keyword  &order=asc|desc
app.get('/api/positions-history', (req, res) => {
    try {
        const dateFrom = (req.query.date_from as string) || ALL_DATES[ALL_DATES.length - 1];
        const dateTo = (req.query.date_to as string) || ALL_DATES[0];
        const tagFilter = (req.query.tag as string) || '';
        const keywordSearch = (req.query.keyword_search as string) || '';
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(500, Math.max(1, parseInt(req.query.limit as string) || 50));
        const sortBy = (req.query.sort as string) || 'volume';
        const order = (req.query.order as string) || 'desc';
        const filterType = (req.query.filter_type as string) || '';

        // Filter keywords
        let filtered = KEYWORDS;

        if (tagFilter) {
            const tags = tagFilter.split(',').map(t => t.trim().toLowerCase());
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

        // Compute metrics for each keyword
        let withMetrics = filtered.map(kw => {
            const metrics = computeMetrics(kw, dateFrom, dateTo);

            // Build position timeline for the date range
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

        // Apply Report Filters
        if (filterType === 'declines') {
            withMetrics = withMetrics.filter(kw => kw.metrics.netChange < 0);
        } else if (filterType === 'improvements') {
            withMetrics = withMetrics.filter(kw => kw.metrics.netChange > 0);
        } else if (filterType === 'first_page') {
            withMetrics = withMetrics.filter(kw => kw.metrics.endPos !== null && kw.metrics.endPos <= 10);
        } else if (filterType === 'top_3') {
            withMetrics = withMetrics.filter(kw => kw.metrics.endPos !== null && kw.metrics.endPos <= 3);
        }

        // Sort
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

        // Paginate
        const total = withMetrics.length;
        const totalPages = Math.ceil(total / limit);
        const pageData = withMetrics.slice((page - 1) * limit, page * limit);

        // Compute movers summary across ALL filtered keywords (not just page)
        const movers = { raised: 0, dropped: 0, unchanged: 0, noData: 0 };
        withMetrics.forEach(kw => {
            if (kw.metrics.trend === 'no data') movers.noData++;
            else if (kw.metrics.netChange > 0) movers.raised++;
            else if (kw.metrics.netChange < 0) movers.dropped++;
            else movers.unchanged++;
        });

        res.json({
            data: pageData,
            movers,
            pagination: {
                page,
                limit,
                total,
                totalPages,
            },
            dateRange: { from: dateFrom, to: dateTo },
        });
    } catch (error: any) {
        console.error('[positions-history error]', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/top-movers
//   ?date_from=&date_to=&direction=raised|dropped|all&limit=20
app.get('/api/top-movers', (req, res) => {
    try {
        const dateFrom = (req.query.date_from as string) || ALL_DATES[ALL_DATES.length - 1];
        const dateTo = (req.query.date_to as string) || ALL_DATES[0];
        const direction = (req.query.direction as string) || 'all';
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

        const withMetrics = KEYWORDS
            .map(kw => ({
                keyword: kw.keyword,
                tags: kw.tags,
                volume: kw.volume,
                urlInSerp: kw.urlInSerp,
                metrics: computeMetrics(kw, dateFrom, dateTo),
            }))
            .filter(kw => kw.metrics.dataPoints > 1); // Need at least 2 data points

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

        res.json({
            data: sorted.slice(0, limit),
            dateRange: { from: dateFrom, to: dateTo },
        });
    } catch (error: any) {
        console.error('[top-movers error]', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/tag-summary
//   ?date_from=&date_to=
app.get('/api/tag-summary', (req, res) => {
    try {
        const dateFrom = (req.query.date_from as string) || ALL_DATES[ALL_DATES.length - 1];
        const dateTo = (req.query.date_to as string) || ALL_DATES[0];

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

        res.json({
            data: result,
            dateRange: { from: dateFrom, to: dateTo },
        });
    } catch (error: any) {
        console.error('[tag-summary error]', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/keyword/:keyword  - detailed data for a single keyword
app.get('/api/keyword/:keyword', (req, res) => {
    const kw = KEYWORDS.find(k => k.keyword.toLowerCase() === req.params.keyword.toLowerCase());
    if (!kw) {
        return res.status(404).json({ error: 'Keyword not found' });
    }

    // Return all position data chronologically
    const timeline = ALL_DATES
        .slice()
        .sort()
        .map(date => ({
            date,
            position: kw.positions[date] ?? null,
        }));

    res.json({
        keyword: kw.keyword,
        tags: kw.tags,
        volume: kw.volume,
        urlInSerp: kw.urlInSerp,
        expectedUrl: kw.expectedUrl,
        timeline,
    });
});

// GET /api/dates - available dates
app.get('/api/dates', (_req, res) => {
    res.json(ALL_DATES.slice().sort());
});

// ---------------------------------------------------------------------------
// Catch-All Static Frontend Route
// ---------------------------------------------------------------------------
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Endpoint not found' });
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Serpstat Tracker Backend running on port ${PORT}`);
    console.log(`Loaded ${KEYWORDS.length} keywords across ${ALL_DATES.length} dates`);
});
