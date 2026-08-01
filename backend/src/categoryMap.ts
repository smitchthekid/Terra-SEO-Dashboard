import fs from 'fs';
import path from 'path';

/**
 * Permanent keyword -> category tags lookup, sourced from the curated
 * Terra SEO Report export. Serpstat's API has no concept of these
 * categories, so live-synced data always comes back untagged; this map is
 * the single source of truth applied on top of every data path (CSV
 * upload, CSV-URL upload, Serpstat live sync, startup cache load).
 */
let CATEGORY_MAP: Record<string, string[]> | null = null;

function loadCategoryMap(): Record<string, string[]> {
    if (CATEGORY_MAP) return CATEGORY_MAP;
    const mapPath = path.resolve(__dirname, 'category-map.json');
    try {
        CATEGORY_MAP = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
    } catch (e: any) {
        console.error('[CategoryMap] Failed to load category-map.json:', e.message);
        CATEGORY_MAP = {};
    }
    return CATEGORY_MAP!;
}

/**
 * Apply the permanent category map to a list of keyword records, in place.
 * Keywords found in the map get their tags set from it (the curated source
 * of truth). Keywords not in the map keep whatever tags they already have
 * (usually none, for keywords added to Serpstat after the file was built).
 */
export function applyCategoryTags<T extends { keyword: string; tags: string[] }>(keywords: T[]): T[] {
    const map = loadCategoryMap();
    for (const kw of keywords) {
        const tags = map[kw.keyword.toLowerCase().trim()];
        if (tags) kw.tags = tags;
    }
    return keywords;
}
