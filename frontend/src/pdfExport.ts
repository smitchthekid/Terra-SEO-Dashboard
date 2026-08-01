/**
 * PDF Export
 * Generates a single consolidated PDF report covering Overview, Opportunities,
 * Losses, and Product Segments (KeywordDetailView is a per-keyword drill-down
 * page and is intentionally excluded from the full report).
 *
 * Uses jsPDF + jspdf-autotable (v5). jspdf-autotable v5 dropped the old
 * `doc.autoTable(...)` side-effect pattern in favor of a standalone
 * `autoTable(doc, options)` function -- see the default import below.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { KEYWORDS, getTagSummary, getDataInfo } from './dataStore';
import { scoreKeyword, applyGlobalFilters } from './metricsEngine';
import type { ScoredKeyword } from './metricsEngine';
import { ANALYST_PRESETS } from './components/GlobalFilterBar';
import type { FilterState } from './components/GlobalFilterBar';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ROW_CAP = 25;
const SEGMENT_ROW_CAP = 50;
const APP_NAME = 'Terra Universal SEO Tracker';

const BRAND: [number, number, number] = [79, 70, 229]; // indigo-600
const BRAND_DARK: [number, number, number] = [67, 56, 202]; // indigo-700
const EMERALD: [number, number, number] = [5, 150, 105];
const RED: [number, number, number] = [220, 38, 38];
const TEXT_DARK: [number, number, number] = [31, 41, 55];
const TEXT_MUTED: [number, number, number] = [107, 114, 128];
const ROW_ALT: [number, number, number] = [249, 250, 251];

export interface PdfReportOptions {
    dateFrom: string;
    dateTo: string;
    /**
     * The active GlobalFilterBar filter state for the view the export was
     * triggered from. Omit (or pass undefined) for the "Export Full Report"
     * app-wide entry point, which always covers the full unfiltered dataset.
     */
    filterState?: FilterState;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatChange(n: number): string {
    return n > 0 ? `+${n}` : `${n}`;
}

function describeFilters(filterState?: FilterState): string[] {
    if (!filterState) {
        return ['Full unfiltered dataset -- all keywords, all categories, all rank bands.'];
    }
    const lines: string[] = [];
    const preset = ANALYST_PRESETS.find(p => p.id === filterState.preset);
    if (preset && preset.id !== 'all') lines.push(`Preset: ${preset.name}`);
    if (filterState.keywordSearch) lines.push(`Keyword search: "${filterState.keywordSearch}"`);
    if (filterState.rankBand && filterState.rankBand !== 'all') lines.push(`Rank band: ${filterState.rankBand}`);
    if (filterState.valueTier && filterState.valueTier !== 'all') lines.push(`Value tier: ${filterState.valueTier}`);
    if (filterState.categoryTag && filterState.categoryTag !== 'all') lines.push(`Category: ${filterState.categoryTag}`);
    if (lines.length === 0) lines.push('No filters applied -- showing all keywords in the selected date range.');
    return lines;
}

function getScoredKeywords(dateFrom: string, dateTo: string, filterState?: FilterState): ScoredKeyword[] {
    const scored = KEYWORDS.map(k => scoreKeyword(k, dateFrom, dateTo));
    return filterState ? applyGlobalFilters(scored, filterState) : scored;
}

const tableStyles = { fontSize: 8, cellPadding: 4, textColor: TEXT_DARK, lineColor: [229, 231, 235] as [number, number, number], lineWidth: 0.5 };
const headStyles = { fillColor: BRAND, textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const, fontSize: 8 };
const alternateRowStyles = { fillColor: ROW_ALT };

function drawSectionHeader(doc: jsPDF, pageWidth: number, margin: number, title: string, subtitle: string): number {
    doc.setFillColor(...BRAND);
    doc.rect(0, 0, pageWidth, 6, 'F');

    let y = 45;
    doc.setTextColor(...TEXT_DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(title, margin, y);

    y += 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(subtitle, margin, y);

    y += 10;
    doc.setDrawColor(229, 231, 235);
    doc.line(margin, y, pageWidth - margin, y);

    return y + 22;
}

function drawKpiRow(doc: jsPDF, margin: number, y: number, items: { label: string; value: string; color?: [number, number, number] }[]): number {
    const colWidth = 130;
    items.forEach((item, i) => {
        const x = margin + i * colWidth;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(...(item.color ?? TEXT_DARK));
        doc.text(item.value, x, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...TEXT_MUTED);
        doc.text(item.label, x, y + 12);
    });
    return y + 34;
}

function addPageFootersAndNumbers(doc: jsPDF, pageWidth: number): void {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...TEXT_MUTED);
        doc.text(APP_NAME, 40, pageHeight - 20);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - 40, pageHeight - 20, { align: 'right' });
    }
}

// ---------------------------------------------------------------------------
// Title Page
// ---------------------------------------------------------------------------

function drawTitlePage(
    doc: jsPDF,
    pageWidth: number,
    margin: number,
    opts: { dateFrom: string; dateTo: string; filterState?: FilterState; totalKeywords: number },
): void {
    doc.setFillColor(...BRAND);
    doc.rect(0, 0, pageWidth, 150, 'F');
    doc.setFillColor(...BRAND_DARK);
    doc.rect(0, 140, pageWidth, 10, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.text(APP_NAME, margin, 65);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(14);
    doc.text('Full SEO Performance Report', margin, 92);
    doc.setFontSize(10);
    doc.text('Overview  •  Opportunities  •  Losses  •  Product Segments', margin, 112);

    let y = 195;
    doc.setTextColor(...TEXT_DARK);

    const metaRow = (label: string, value: string) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.text(label, margin, y);
        doc.setFont('helvetica', 'normal');
        doc.text(value, margin + 150, y);
        y += 20;
    };

    metaRow('Report generated:', new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }));
    metaRow('Date range covered:', `${opts.dateFrom} to ${opts.dateTo}`);
    metaRow('Keywords tracked:', opts.totalKeywords.toLocaleString());

    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('Active filters:', margin, y);
    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...TEXT_MUTED);
    describeFilters(opts.filterState).forEach(line => {
        doc.text(`• ${line}`, margin + 10, y);
        y += 15;
    });

    y += 20;
    doc.setDrawColor(229, 231, 235);
    doc.line(margin, y, pageWidth - margin, y);
    y += 22;

    doc.setFontSize(9.5);
    doc.setTextColor(...TEXT_MUTED);
    const notes = [
        'This report consolidates the Overview, Opportunities, Losses, and Product Segments views into a',
        'single document. Each section table is capped to the top rows (by its primary ranking metric) for',
        'readability -- use the live dashboard to drill into the complete, unfiltered dataset.',
    ];
    notes.forEach(line => {
        doc.text(line, margin, y);
        y += 14;
    });
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function drawOverviewSection(doc: jsPDF, pageWidth: number, margin: number, scored: ScoredKeyword[]): void {
    let y = drawSectionHeader(
        doc,
        pageWidth,
        margin,
        'Overview',
        'Portfolio-wide KPIs and the highest-value tracked keywords, ranked by Value Score.',
    );

    let totalValue = 0, totalOpp = 0, totalRisk = 0, firstPageCount = 0;
    scored.forEach(k => {
        totalValue += k.valueScore;
        totalOpp += k.opportunityScore;
        totalRisk += k.riskScore;
        if (k.currentPos !== null && k.currentPos <= 10) firstPageCount++;
    });

    y = drawKpiRow(doc, margin, y, [
        { label: 'EST. MONTHLY ORGANIC VALUE', value: `${totalValue.toLocaleString()} pts` },
        { label: 'OPPORTUNITY PIPELINE', value: `${totalOpp.toLocaleString()} pts`, color: EMERALD },
        { label: 'AT-RISK VALUE', value: `${totalRisk.toLocaleString()} pts`, color: RED },
        { label: 'TOP 10 FOOTPRINT', value: `${firstPageCount} terms` },
    ]);
    y += 4;

    const top = [...scored].sort((a, b) => b.valueScore - a.valueScore).slice(0, ROW_CAP);
    autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Keyword', 'Volume', 'Pos', 'Change', 'Value Score', 'Rank Band', 'Category']],
        body: top.map(k => [
            k.keyword,
            k.volume.toLocaleString(),
            k.currentPos ?? '-',
            formatChange(k.netChange),
            k.valueScore.toLocaleString(),
            k.rankBand,
            k.tags[0] ?? '',
        ]),
        styles: tableStyles,
        headStyles,
        alternateRowStyles,
        columnStyles: {
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right' },
        },
    });
}

function drawOpportunitiesSection(doc: jsPDF, pageWidth: number, margin: number, scored: ScoredKeyword[]): void {
    const y = drawSectionHeader(
        doc,
        pageWidth,
        margin,
        'Opportunities',
        'Highest-upside keywords, ranked by Opportunity Score (proximity to a rank/CTR breakthrough).',
    );

    const top = [...scored]
        .filter(k => k.opportunityScore > 0)
        .sort((a, b) => b.opportunityScore - a.opportunityScore)
        .slice(0, ROW_CAP);

    autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Keyword', 'Volume', 'Pos', 'Change', 'Opportunity Score', 'Category']],
        body: top.length > 0
            ? top.map(k => [
                k.keyword,
                k.volume.toLocaleString(),
                k.currentPos ?? '-',
                formatChange(k.netChange),
                k.opportunityScore.toLocaleString(),
                k.tags[0] ?? '',
            ])
            : [['No opportunity keywords match the active filters.', '', '', '', '', '']],
        styles: tableStyles,
        headStyles: { ...headStyles, fillColor: EMERALD },
        alternateRowStyles,
        columnStyles: {
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right' },
        },
    });
}

function drawLossesSection(doc: jsPDF, pageWidth: number, margin: number, scored: ScoredKeyword[]): void {
    const y = drawSectionHeader(
        doc,
        pageWidth,
        margin,
        'Losses',
        'Highest-risk declining keywords, ranked by Risk Score (position drop severity x search volume).',
    );

    const top = [...scored]
        .filter(k => k.netChange < 0)
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, ROW_CAP);

    autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Keyword', 'Volume', 'Prev Pos', 'Current Pos', 'Drop', 'Risk Score', 'Category']],
        body: top.length > 0
            ? top.map(k => [
                k.keyword,
                k.volume.toLocaleString(),
                k.previousPos ?? '-',
                k.currentPos ?? '-',
                formatChange(k.netChange),
                k.riskScore.toLocaleString(),
                k.tags[0] ?? '',
            ])
            : [['No declining keywords match the active filters.', '', '', '', '', '', '']],
        styles: tableStyles,
        headStyles: { ...headStyles, fillColor: RED },
        alternateRowStyles,
        columnStyles: {
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right' },
            5: { halign: 'right' },
        },
    });
}

interface TagSummaryRow {
    tag: string;
    keywords: number;
    totalVolume: number;
    avgPosition: string;
    totalNetChange: number;
    raised: number;
    dropped: number;
}

function drawSegmentsSection(doc: jsPDF, pageWidth: number, margin: number, tagSummary: TagSummaryRow[]): void {
    const y = drawSectionHeader(
        doc,
        pageWidth,
        margin,
        'Product Segments',
        'Aggregated search volume, keyword counts, and net ranking movement grouped by product category tag.',
    );

    const top = [...tagSummary].sort((a, b) => b.totalVolume - a.totalVolume).slice(0, SEGMENT_ROW_CAP);

    autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Category Tag', 'Keywords', 'Total Volume', 'Avg Position', 'Net Movement', 'Gained', 'Lost']],
        body: top.length > 0
            ? top.map(t => [
                t.tag,
                t.keywords,
                t.totalVolume.toLocaleString(),
                t.avgPosition || '-',
                formatChange(t.totalNetChange),
                t.raised,
                t.dropped,
            ])
            : [['No categories match the active filters.', '', '', '', '', '', '']],
        styles: tableStyles,
        headStyles,
        alternateRowStyles,
        columnStyles: {
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right' },
            5: { halign: 'right' },
            6: { halign: 'right' },
        },
    });
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Generates and downloads a single consolidated PDF report covering the
 * Overview, Opportunities, Losses, and Product Segments views.
 *
 * Pass `filterState` when triggering from within a view (the active
 * GlobalFilterBar filters + date range are honored). Omit it for the
 * app-wide "Export Full Report" entry point, which always covers the full
 * unfiltered dataset for the currently-selected date range.
 */
export function generateFullReportPdf(options: PdfReportOptions): void {
    const { dateFrom, dateTo, filterState } = options;

    const scored = getScoredKeywords(dateFrom, dateTo, filterState);
    const dataInfo = getDataInfo();
    const tagSummaryResult = getTagSummary({ date_from: dateFrom, date_to: dateTo });
    const tagSummary: TagSummaryRow[] = tagSummaryResult.data || [];

    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;

    drawTitlePage(doc, pageWidth, margin, {
        dateFrom,
        dateTo,
        filterState,
        totalKeywords: dataInfo.totalKeywords ?? scored.length,
    });

    doc.addPage();
    drawOverviewSection(doc, pageWidth, margin, scored);

    doc.addPage();
    drawOpportunitiesSection(doc, pageWidth, margin, scored);

    doc.addPage();
    drawLossesSection(doc, pageWidth, margin, scored);

    doc.addPage();
    drawSegmentsSection(doc, pageWidth, margin, tagSummary);

    addPageFootersAndNumbers(doc, pageWidth);

    const stamp = new Date().toISOString().slice(0, 10);
    const suffix = filterState ? 'filtered' : 'full';
    doc.save(`terra-seo-report-${suffix}-${stamp}.pdf`);
}
