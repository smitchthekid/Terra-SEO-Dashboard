# SEO App Integration Project Plan

## Overview
This project plan outlines a step-by-step implementation path for integrating the recommended SEO app improvements into the current route structure, which includes SEO Report, Dashboard, Trends, Movers, Biggest Declines, Biggest Improvements, High Impact Items, Rank First Page, Rank Top 3, and Product Categories.[cite:1] The goal is to convert the current collection of route-based reports into a unified analysis system that prioritizes highest-value keyword insights, trend clarity, and smoother report flow.[cite:1]

The plan also aligns with the user’s preferred AI working style by emphasizing planning mode, approval before UI changes, clean formatting, and structured implementation rather than ad hoc page edits.[cite:2][cite:3][cite:4][cite:5]

## Phase 1: Project setup
1. Start the build in planning mode and do not begin coding until the new route map, shared metrics model, and component strategy are approved.[cite:5]
2. Freeze the current route inventory and document the purpose of each route in the current app navigation.[cite:1]
3. Record the current filter set, current charts, KPI blocks, table behavior, export behavior, and routing dependencies for each page.[cite:1]
4. Create a working migration document that maps current pages to future parent views.[cite:1]
5. Preserve compatibility by planning temporary wrappers or redirects for old routes during migration.[cite:1]

## Phase 2: Product audit
1. Audit every current route and answer the following for each page: what user question it answers, what decision it supports, what overlap exists with other routes, and whether it prioritizes highest-value keywords first.[cite:1]
2. Score each page against these criteria: insight value, trend clarity, actionability, filter consistency, and cross-page cohesion.[cite:1]
3. Group routes into three buckets: keep mostly intact, consolidate into parent views, or rebuild.[cite:1]
4. Specifically review duplication among SEO Report and Dashboard, Movers and Biggest Improvements and Biggest Declines, and Rank First Page and Rank Top 3.[cite:1]
5. Summarize the audit in a concise internal document before any engineering work begins.[cite:1]

## Phase 3: New information architecture
1. Reorganize the app around five parent views: Overview, Opportunities, Losses, Segments, and Keyword Detail.[cite:1]
2. Map SEO Report and Dashboard into Overview.[cite:1]
3. Map Rank First Page, Rank Top 3, and High Impact Items into Opportunities.[cite:1]
4. Map Biggest Declines into Losses and Product Categories into Segments.[cite:1]
5. Convert Trends into a reusable trend mode inside the parent views rather than leaving it as a disconnected standalone experience.[cite:1]
6. Move Movers and Biggest Improvements into sub-tabs or filtered modes under Opportunities and Losses.[cite:1]

## Phase 4: Shared metrics layer
1. Create a shared metrics module used by every route and component.[cite:1]
2. Define a Keyword Value Score that combines click potential, rank proximity, momentum, and optional business weighting.[cite:1]
3. Define an Opportunity Score to prioritize near-win keywords and threshold-cross candidates.[cite:1]
4. Define a Risk Score to highlight high-value declines and threshold losses.[cite:1]
5. Define a Momentum Score to distinguish steady trend direction from one-period noise.[cite:1]
6. Define shared threshold bands such as Top 3, Positions 4 to 10, Positions 11 to 20, and Positions 21+.[cite:1]
7. Define shared change types such as new win, near win, stable, soft decline, hard decline, recovered, and crossed threshold.[cite:1]
8. Ensure no individual page creates its own private scoring logic outside the shared layer.[cite:1]

## Phase 5: Global filter framework
1. Build one reusable filter bar component for all major views using the current filter foundation of date range, query contains, URL contains, max average position, category search, and reset.[cite:1]
2. Add new shared filters for rank band, value tier, trend direction, and saved presets.[cite:1]
3. Add analyst presets such as Highest Value Opportunities, Highest Value Declines, Near Wins, Lost First Page, Top 3 Push Candidates, and Stable High-Value Terms.[cite:1]
4. Persist filter state across route changes so the app feels continuous rather than page-based.[cite:1]
5. Add active filter chips and contextual subtitles that reflect the current filtered state.[cite:1]
6. Ensure every chart and table uses the same global filter state.[cite:1]

## Phase 6: Shared page template
1. Standardize every major page into the same layout structure: context header, KPI row, primary chart, diagnostic breakdown, and drill-down table.[cite:1]
2. Use compact KPI cards with sparklines or micro-trends where useful.[cite:1]
3. Make the primary chart the main narrative device on each page, not decorative support.[cite:1]
4. Keep the diagnostic section focused on why the trend happened or which segments contributed most.[cite:1]
5. Use the drill-down table as the universal detail view at the bottom of each page.[cite:1]

## Phase 7: Route-by-route rebuild
### Overview
1. Rebuild Overview from the best parts of SEO Report and Dashboard.[cite:1]
2. Include KPIs for value gained, value lost, threshold crossings, and priority changes.[cite:1]
3. Add a primary trend view by value band or segment contribution.[cite:1]
4. Add prioritized insight cards for biggest opportunities, biggest risks, and strongest segment movers.[cite:1]

### Opportunities
1. Merge Rank First Page, Rank Top 3, and High Impact Items into Opportunities.[cite:1]
2. Create sub-tabs for Near Wins, Top 3 Push, Priority Actions, and Gains.[cite:1]
3. Use a scatterplot of rank versus opportunity or value potential as the primary chart.[cite:1]
4. Keep the default table sorted by Opportunity Score or Keyword Value Score, not raw movement.[cite:1]

### Losses
1. Rebuild Biggest Declines into a deeper Losses page.[cite:1]
2. Group losses by severity, threshold loss type, category impact, and URL impact.[cite:1]
3. Use a waterfall or contribution chart to show value lost.[cite:1]
4. Prioritize defensive actions in the table and insight callouts.[cite:1]

### Segments
1. Rebuild Product Categories into a broader Segments view.[cite:1]
2. Include categories, tags, landing page groups, or other segmentation models available in the data.[cite:1]
3. Use heatmaps or stacked trend views to show where gains and losses are concentrated.[cite:1]
4. Make every segment row drill into the exact keywords and URLs responsible for the trend.[cite:1]

### Keyword Detail
1. Add a dedicated keyword-level drill-down page or panel.[cite:1]
2. Show rank history, threshold events, click potential trend, associated URL, and segment membership.[cite:1]
3. Allow all parent pages to deep-link into this detail view.[cite:1]

## Phase 8: Visualization upgrades
1. Replace passive summary visuals with chart types that support diagnosis and prioritization.[cite:1]
2. Use scatterplots for opportunity analysis, slope charts for prior versus current movement, waterfall charts for gained or lost value, heatmaps for segments, and sparklines inside tables.[cite:1]
3. Apply one consistent color system across gains, losses, stability, and value tiers so visual meaning remains constant from page to page.[cite:1]
4. Make every chart interactive so clicking a point, bar, or heatmap cell updates the whole page state.[cite:1]
5. Ensure all charts support tooltips with contextual labels such as threshold crossed, value at risk, or near-win candidate.[cite:1]

## Phase 9: Reusable components
1. Build shared components instead of page-specific one-off implementations.[cite:1][cite:5]
2. Core components should include GlobalFilterBar, ActiveFilterChips, ValueKpiCard, SparklineKpiCard, ThresholdBadge, InsightCallout, DrilldownTable, PrimaryTrendChart, SegmentBreakdownChart, LoadingSkeleton, EmptyState, and SavedPresetMenu.[cite:1]
3. Centralize table behavior, sorting patterns, chart callback handling, and export utilities in reusable wrappers.[cite:1]
4. Confirm approval before making interface or component-level styling changes, in line with the user’s AI coding preferences.[cite:5]

## Phase 10: Action and insight engine
1. Expand the logic behind High Impact Items into a reusable insight engine used throughout the app.[cite:1]
2. After filters are applied, generate a small set of prioritized insight cards such as biggest upside, highest-value decline, category causing the most drag, and strongest threshold-cross candidates.[cite:1]
3. Link each insight card to a prefiltered table or destination subview.[cite:1]
4. Keep insight copy short, metric-driven, and consistent with the shared scoring system.[cite:1]

## Phase 11: Trend analysis enhancement
1. Extend trend analysis beyond simple point-to-point comparisons by supporting rolling windows such as 7, 30, 60, and 90 days where data allows.[cite:1]
2. Add momentum and volatility calculations so the app can distinguish stable growth from noisy movement.[cite:1]
3. Precompute threshold events to show when keywords entered or exited Top 3, Top 10, or first page bands.[cite:1]
4. Surface compact trend indicators across KPI cards, charts, and tables.[cite:1]

## Phase 12: QA and migration validation
1. Verify that every major page uses the same metric definitions and filter logic.[cite:1]
2. Verify that filters persist across route changes and old routes still resolve correctly during migration.[cite:1]
3. Verify that chart interactions update full page state, not isolated widgets.[cite:1]
4. Verify that the top rows in key tables reflect highest-value terms rather than simply highest movement.[cite:1]
5. Verify empty states, loading states, filter-no-match states, and export behavior.[cite:1]
6. Verify that compact layouts remain readable and actionable for dense SEO workflows.[cite:1]

## Suggested build order
1. Audit all routes and dependencies.[cite:1]
2. Build the shared metrics layer.[cite:1]
3. Build the global filter framework.[cite:1]
4. Build reusable KPI, chart, and table wrappers.[cite:1]
5. Rebuild Overview.[cite:1]
6. Rebuild Opportunities.[cite:1]
7. Rebuild Losses.[cite:1]
8. Rebuild Segments.[cite:1]
9. Add Keyword Detail drill-down.[cite:1]
10. Wrap or redirect legacy routes into the new architecture.[cite:1]
11. Run QA and polish for cohesion, compactness, and actionability.[cite:1]

## Delivery guidance for the AI assistant
The AI assistant should treat this work as a staged product refactor rather than a series of isolated page edits.[cite:1] The assistant should plan first, get approval before visual or structural changes, centralize shared logic before page rebuilds, and migrate routes gradually to avoid breaking the current app experience.[cite:1][cite:5]
