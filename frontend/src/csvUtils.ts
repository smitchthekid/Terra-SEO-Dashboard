/**
 * Escapes a cell value for CSV output.
 * Wraps in quotes if the value contains commas, quotes, or newlines.
 */
function escapeCell(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return '';
    const s = String(value);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

/**
 * Triggers a CSV file download in the browser.
 * Export honors whatever filtered/sorted data is passed in — no re-fetching.
 */
export function downloadCsv(
    filename: string,
    headers: string[],
    rows: (string | number | null | undefined)[][],
): void {
    const lines = [
        headers.map(escapeCell).join(','),
        ...rows.map(row => row.map(escapeCell).join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}
