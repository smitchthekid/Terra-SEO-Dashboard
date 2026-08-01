import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import axios from 'axios';
import { applyCategoryTags } from './categoryMap';

// Load env variables
dotenv.config();

interface KeywordRecord {
    keyword: string;
    tags: string[];
    volume: number;
    positions: Record<string, number | null>;
    urlInSerp: string;
    expectedUrl: string;
}

let KEYWORDS: KeywordRecord[] = [];
let ALL_DATES: string[] = [];

function normalizeDate(raw: string): string | null {
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
}

function transformSerpstatData(records: any[]): void {
    if (!records || records.length === 0) {
        throw new Error('No keyword data returned from Serpstat');
    }

    const dateSet = new Set<string>();
    const newKeywords: KeywordRecord[] = [];

    for (const rec of records) {
        const keyword = rec.keyword || rec.query || rec.name || rec.phrase || '';
        if (!keyword) continue;

        // Tags and volume (from REST API fields)
        const tagsRaw = rec.tags || rec.categories || rec.tag || [];
        const tags: string[] = Array.isArray(tagsRaw)
            ? tagsRaw.map((t: any) => String(t).trim()).filter((t: string) => t.length > 0)
            : String(tagsRaw).split(',').map(t => t.trim()).filter(t => t.length > 0);

        const volume = parseInt(String(rec.volume || rec.frequency || rec.search_volume || 0)) || 0;

        const positions: Record<string, number | null> = {};
        // History from Serpstat REST API is in `history`
        const posHistory = rec.history || rec.positions || rec.position_history || [];

        let firstUrl = '';
        if (Array.isArray(posHistory)) {
            for (const entry of posHistory) {
                const date = normalizeDate(entry.date || entry.check_date || entry.created_at || '');
                // Serpstat REST API nests the actual rank inside a `positions` array per date entry
                const posEntry = Array.isArray(entry.positions) ? entry.positions[0] : null;
                const pos = posEntry?.position ?? entry.position ?? entry.pos ?? entry.rank ?? null;
                const url = posEntry?.url ?? entry.url;
                if (date) {
                    dateSet.add(date);
                    positions[date] = (pos !== null && pos !== undefined && pos !== 0) ? Number(pos) : null;
                    if (!firstUrl && url) {
                        firstUrl = url;
                    }
                }
            }
        } else if (typeof posHistory === 'object') {
            for (const [date, pos] of Object.entries(posHistory)) {
                const normalizedDate = normalizeDate(date);
                if (normalizedDate) {
                    dateSet.add(normalizedDate);
                    const numPos = Number(pos);
                    positions[normalizedDate] = (isNaN(numPos) || numPos === 0) ? null : numPos;
                }
            }
        }

        const urlInSerp = rec.url || firstUrl || rec.found_url || rec.serp_url || '';
        const expectedUrl = rec.expectedUrl || rec.expected_url || rec.target_url || '';

        newKeywords.push({ keyword, tags, volume, positions, urlInSerp, expectedUrl });
    }

    if (newKeywords.length === 0) {
        throw new Error('Could not parse any keywords from Serpstat response');
    }

    // Sort dates newest first
    ALL_DATES = Array.from(dateSet).sort((a, b) => b.localeCompare(a));
    KEYWORDS = applyCategoryTags(newKeywords);
}

export async function refreshData(): Promise<void> {
    const token = process.env.SERPSTAT_API_TOKEN;
    if (!token || token === 'your_serpstat_api_token_here') {
        throw new Error('SERPSTAT_API_TOKEN is not configured in .env');
    }

    const projectId = Number(process.env.SERPSTAT_PROJECT_ID || '1171287');
    const regionId = Number(process.env.SERPSTAT_REGION_ID || '356297');

    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(today.getMonth() - 6);

    const dateFrom = sixMonthsAgo.toISOString().split('T')[0];
    const dateTo = today.toISOString().split('T')[0];

    const apiUrl = `https://api.serpstat.com/v4?token=${token}`;
    console.log(`[Refresh Script] Fetching positions history from Serpstat API for Project: ${projectId}, Region: ${regionId} from ${dateFrom} to ${dateTo}...`);

    let page = 1;
    const pageSize = 100;
    let allRecords: any[] = [];
    let hasMore = true;

    while (hasMore) {
        console.log(`[Refresh Script] Fetching page ${page}...`);
        const payload = {
            id: page,
            method: 'RtApiSerpResultsProcedure.getUrlsSerpResultsHistory',
            params: {
                projectId,
                projectRegionId: regionId,
                dateFrom,
                dateTo,
                page,
                pageSize
            }
        };

        const response = await axios.post(apiUrl, payload);
        if (response.data?.error) {
            throw new Error(`Serpstat API error: ${response.data.error.message}`);
        }

        const keywords = response.data?.result?.data?.keywords || [];
        console.log(`[Refresh Script] Page ${page} returned ${keywords.length} keywords.`);

        if (keywords.length === 0) {
            hasMore = false;
        } else {
            allRecords = allRecords.concat(keywords);
            if (keywords.length < pageSize) {
                hasMore = false;
            } else {
                page++;
            }
        }
    }

    console.log(`[Refresh Script] Total keywords fetched: ${allRecords.length}. Transforming...`);
    transformSerpstatData(allRecords);

    const cachePath = path.resolve(__dirname, 'data-cache.json');
    console.log(`[Refresh Script] Writing data to ${cachePath}...`);
    fs.writeFileSync(cachePath, JSON.stringify({
        keywords: KEYWORDS,
        allDates: ALL_DATES,
        updatedAt: new Date().toISOString()
    }, null, 2));

    console.log(`[Refresh Script] Successfully wrote cache. Keywords: ${KEYWORDS.length}, Dates: ${ALL_DATES.length}`);
}

// Allow execution directly from CLI
if (require.main === module) {
    refreshData()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('[Refresh Script] Failure:', err.message);
            process.exit(1);
        });
}
