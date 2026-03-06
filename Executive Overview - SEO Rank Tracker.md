# Terra Universal SEO Rank Tracker -- Executive Overview

## What This Report Does

The Terra SEO Rank Tracker monitors how Terra Universal's website ranks in Google search results for tracked keywords over time. It provides actionable intelligence on ranking performance across product categories.

### Report Pages

| Page | Purpose |
|------|---------|
| **SEO Report** | Period-over-period summary with click potential, rank trends, and category breakdowns |
| **Dashboard** | At-a-glance view of total keywords tracked, improvements, declines, and category volume |
| **Trends** | Full keyword table with position history, sortable and filterable by tag or search term |
| **Movers** | Keywords with the largest rank changes (up or down) between selected date ranges |
| **Biggest Declines** | Keywords that lost the most ranking positions -- prioritized for investigation |
| **Biggest Improvements** | Keywords that gained the most ranking positions -- validates SEO efforts |
| **High Impact Items** | Flagged keywords with notable rank changes, filtered to volume 100+. Includes timeline chart, category pie chart, and visibility loss alerts (Lost Top 5, Lost First Page) |
| **Rank First Page / Top 3** | Keywords currently ranking on page 1 (positions 1-10) or in the top 3 |
| **Product Categories** | Tag-level rollup showing average rank, net movement, and volume per product category |

### Key Metrics

- **Rank Position**: Where a keyword appears in Google search results (1 = top result)
- **Search Volume**: Estimated monthly searches for that keyword
- **Net Change**: How many positions a keyword moved between two dates (positive = improved)
- **FPCP (First Page Click Potential)**: Estimated click value for keywords ranking on page 1
- **Power Score**: Combined measure of search volume and current rank
- **Impact Score**: Volume divided by rank -- higher means more valuable traffic at risk

## How Data Is Collected

### Data Sources

The report supports three methods of data ingestion:

1. **CSV File Upload** -- Drag and drop a Serpstat rank tracker CSV export directly into the app. This is the most common method. The CSV contains keywords, tags, search volume, and historical rank positions across check-in dates.

2. **Google Sheets URL** -- Paste a link to a publicly shared Google Sheet containing the same CSV-format data. The app automatically converts the share link to a CSV export URL and fetches the data.

3. **Serpstat MCP Integration** -- Connect directly to Serpstat's API via their MCP (Model Context Protocol) server. This pulls live rank tracker data from your Serpstat account without needing to manually export files. Requires a Serpstat Team plan API token configured on the server.

### Data Flow

```
Serpstat Rank Tracker (serpstat.com)
        |
        |-- Manual CSV export --> Upload to app
        |-- Google Sheets sync --> Paste URL into app
        |-- MCP API connection --> Select project, click Fetch
        |
        v
  Terra SEO Dashboard
  (processes and visualizes the data)
```

### What Serpstat Tracks

Serpstat's rank tracker checks Google search results on a scheduled basis (typically weekly or bi-weekly) for a configured set of keywords. For each check, it records:

- The keyword's SERP position (1-100+)
- Which URL from the domain appeared in results
- The keyword's estimated monthly search volume
- Tags/categories assigned to the keyword in Serpstat

### Data Freshness

The data reflects the most recent Serpstat rank check. Date ranges shown in the report correspond to the check-in dates from Serpstat. Rank checks are not daily -- they follow the schedule configured in the Serpstat project (commonly every 3-7 days).

## Access

The report runs as a local web application at `http://localhost:5173` and requires both the backend server (port 3001) and frontend dev server to be running. For production deployment, it can be built and hosted on platforms like Railway.
