# Handoff Context & State

## Current Branch
- main

## Current App State
- Backend running on http://localhost:3001.
- Frontend running on http://localhost:5174.
- July-Updates 5-parent view architecture refactor fully implemented and verified.

## Locked Architectural Decisions
- Backend: Express + tsx on port 3001.
- Frontend: React 19 + Vite + TanStack React Query + Recharts on port 5174.
- Core Parent Views: Overview (`/overview`), Opportunities (`/opportunities`), Losses (`/losses`), Segments (`/segments`), Keyword Detail (`/keyword/:keywordId`).
- Legacy Compatibility: Legacy routes (`/seo-overview`, `/dashboard`, `/movers`, `/declines`, `/top-3`, etc.) redirect cleanly to parent views.

## Last Changes
- Implemented `metricsEngine.ts` for Keyword Value Score, Opportunity Score, Risk Score, and Rank Bands.
- Created `GlobalFilterBar.tsx` and `InsightCard.tsx`.
- Created `OverviewView.tsx`, `OpportunitiesView.tsx`, `LossesView.tsx`, `SegmentsView.tsx`, and `KeywordDetailView.tsx`.
- Updated `App.tsx` router and verified 0-error TypeScript builds for backend and frontend.

## Next Pending Task
- Ready for user interaction or further feature additions.
