// Shared helper for building a multi-line recharts-ready series from a set
// of keywords' position histories -- one row per date, one key per keyword.
// Used wherever a table's row selection needs to drive a rank-trend chart.
export function buildKeywordTrendSeries(
    keywords: { keyword: string; positions: Record<string, number | null> }[],
): Array<Record<string, string | number>> {
    const dateMap: Record<string, Record<string, string | number>> = {};
    keywords.forEach(k => {
        Object.entries(k.positions || {}).forEach(([date, pos]) => {
            if (pos === null || pos === undefined) return;
            if (!dateMap[date]) dateMap[date] = { date };
            dateMap[date][k.keyword] = pos;
        });
    });
    return Object.values(dateMap).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export const TREND_LINE_COLORS = [
    '#044a63', '#ad4385', '#ffa600', '#f75c5c', '#5480B3', '#D8A130', '#7a4387', '#d94875',
];
