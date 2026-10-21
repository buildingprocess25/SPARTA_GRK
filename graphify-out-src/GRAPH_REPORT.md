# Graph Report - src  (2026-10-21)

## Corpus Check
- 303 files · ~224,415 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: .css 1, (none) 1)

## Summary
- 1574 nodes · 4726 edges · 51 communities (47 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 26 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- iSolar Sync & Dashboard API
- App Shell & UI Primitives
- Emission Calculator
- Scope 3 Travel Ledger
- Facility & Carbon Batch Import
- Inverter Temperature Pipeline
- Energy Flow Report Import
- Scope 3 Dashboard & Tables
- PLTS Analytics Config & Processor
- Auth & Session Routes
- XLSX & OJK Report Export
- PR Analysis & PLN Tariff
- Scope 2 Charts & Emission Tabs
- Contract Tests
- Alarm System
- Header, Sidebar & Home
- Store Sheet Sync
- Emission Resume Tab
- PLTS Performance Tabs
- PLTS Summary Card
- PLTS Tab & Report Upload
- Command & Dialog UI
- Solar Dashboard Service
- Scope 2 Annual Load Analytics
- KPI Cards & Units
- Load & Matrix Routes
- PLTS Monthly History
- Annual Report & Workbook Import
- RKAP Targets
- Scope 2 Export
- iSolar Monthly CSV Parser
- Audit & Water Recycle Routes
- Import Template Generator
- Annual Load Report Parser
- PLTS Summary Route
- Web Push Notifications
- Grid Emission Factors
- History Repository Tests
- Calculator UI Contract
- Form Primitives
- Emissions Route
- Cache Revalidation
- Data Table
- Energy Reconciliation
- PR Dashboard Route
- Support Dashboard Route
- PLTS Summary Dashboard Route
- Manual PLTS Input
- Health Check
- Global Types

## God Nodes (most connected - your core abstractions)
1. `InfoHint()` - 46 edges
2. `CustomSelect()` - 46 edges
3. `CardBox()` - 38 edges
4. `formatNum()` - 38 edges
5. `Scope3TravelDashboard()` - 31 edges
6. `isDcLocation()` - 28 edges
7. `PLTSTab()` - 27 edges
8. `Scope3InputModal()` - 27 edges
9. `EmisiResumeTab()` - 26 edges
10. `kwhToMwh()` - 26 edges

## Surprising Connections (you probably didn't know these)
- `PLTSMonthlyMatrixTable()` --indirect_call--> `isDcLocation()`  [INFERRED]
  components/plts/PLTSMonthlyMatrixTable.tsx → lib/solar/plantMap.ts
- `PLTSSummaryCard()` --indirect_call--> `isDcLocation()`  [INFERRED]
  components/plts/PLTSSummaryCard.tsx → lib/solar/plantMap.ts
- `Scope2InputModal()` --indirect_call--> `isDcLocation()`  [INFERRED]
  components/scope2/Scope2InputModal.tsx → lib/solar/plantMap.ts
- `GET()` --calls--> `loadActiveAlarms()`  [EXTRACTED]
  app/api/alarms/route.ts → lib/alarms/service.ts
- `cronAuthResponse()` --calls--> `evaluateCronAuthorization()`  [EXTRACTED]
  app/api/cron/isolar-sync/route.ts → lib/server/requestGuards.ts

## Import Cycles
- None detected.

## Communities (51 total, 4 thin omitted)

### Community 0 - "iSolar Sync & Dashboard API"
Cohesion: 0.05
Nodes (69): cronAuthResponse(), GET(), POST(), buildFullDashboardPayload(), GET(), loadAuditBaseline(), POST(), dynamic (+61 more)

### Community 1 - "App Shell & UI Primitives"
Cohesion: 0.06
Nodes (65): metadata, RootLayout(), viewport, AlarmDialog(), formatWibDate(), formatDateTime(), isDeletable(), MODULE_LABELS (+57 more)

### Community 2 - "Emission Calculator"
Cohesion: 0.07
Nodes (58): CalculatorCategoryCard(), CALCULATOR_CATEGORIES, CATEGORY_MAP, CalculatorEntryForm(), DateField(), defaults, freshDefaults(), NumberField() (+50 more)

### Community 3 - "Scope 3 Travel Ledger"
Cohesion: 0.06
Nodes (61): dynamic, fail(), POST(), dynamic, fail(), POST(), currentYearMonthWib(), dynamic (+53 more)

### Community 4 - "Facility & Carbon Batch Import"
Cohesion: 0.07
Nodes (52): POST(), POST(), DELETE(), dynamic, GET(), POST(), buildCategorySlice(), defaultPeriod() (+44 more)

### Community 5 - "Inverter Temperature Pipeline"
Cohesion: 0.08
Nodes (48): aggregateDailyInverterTemp(), aggregateMonthlyInverterTemp(), DC_ENTITIES, evaluateSampleValidity(), formatDateWib(), getWibDayUtcRange(), InverterTempAggregationError, buildRatedPowerIndex() (+40 more)

### Community 6 - "Energy Flow Report Import"
Cohesion: 0.06
Nodes (45): dynamic, fail(), POST(), closedMonthReport(), diffEnergyFlowRows(), energyFlowRowsFromDecisions(), FLOW_FIELDS, isReportRestatement() (+37 more)

### Community 7 - "Scope 3 Dashboard & Tables"
Cohesion: 0.08
Nodes (48): ResumeMonthlyTable(), formatDataAsOf(), ChoiceCard(), EMPTY_FORM, FieldError(), FieldLabel(), number(), Scope3InputModal() (+40 more)

### Community 8 - "PLTS Analytics Config & Processor"
Cohesion: 0.08
Nodes (44): ALL_METRIC_OPTIONS, API_MONTHS, getPlantColor(), METRIC_OPTIONS, PALETTE, formatWibTime(), getDCBadges(), matchesFuzzyQuery() (+36 more)

### Community 9 - "Auth & Session Routes"
Cohesion: 0.08
Nodes (47): dynamic, getClientIp(), isRateLimited(), POST(), dynamic, getClientIp(), isRateLimited(), POST() (+39 more)

### Community 10 - "XLSX & OJK Report Export"
Cohesion: 0.08
Nodes (47): buildOjkWorkbookData(), exportOjkReport(), formatRupiahNum(), buildCombinedMonthlyTrend(), exportCsvReport(), fetchAnnualReportData(), getWibDate(), MONTH_NAMES (+39 more)

### Community 11 - "PR Analysis & PLN Tariff"
Cohesion: 0.08
Nodes (39): dynamic, GET(), calculateCostSavings(), getPlnTariff(), PLN_TARIFF_DEFAULT, PLN_TARIFF_OVERRIDES, PLTS_AVOIDED_EMISSION_FACTOR_KG_PER_KWH, buildLikeForLike() (+31 more)

### Community 12 - "Scope 2 Charts & Emission Tabs"
Cohesion: 0.11
Nodes (39): PenambahEmisiTab(), withGaps(), SummaryYoyComparisonChart(), PLTSMonthlyEnergyCharts(), aggregateByPlant(), aggregateMonthly(), formatFactor(), initialFilters() (+31 more)

### Community 13 - "Contract Tests"
Cohesion: 0.08
Nodes (16): here, here, here, partsDir, source, dashboard, drawer, here (+8 more)

### Community 14 - "Alarm System"
Cohesion: 0.10
Nodes (33): GET(), NO_STORE_HEADERS, useToast(), AlarmContext, AlarmProvider(), createAlarmPollCoordinator(), deduplicateIncomingAlarms(), filterAlarms() (+25 more)

### Community 15 - "Header, Sidebar & Home"
Cohesion: 0.10
Nodes (27): Home(), AlarmBadges(), Header(), ProfileAccountTab(), ProfileMaintenanceTab(), ProfileRolesTab(), ProfileUsersTab(), PengurangEmisiTab() (+19 more)

### Community 16 - "Store Sheet Sync"
Cohesion: 0.10
Nodes (35): cronAuthResponse(), dynamic, GET(), POST(), dynamic, GET(), dynamic, GET() (+27 more)

### Community 17 - "Emission Resume Tab"
Cohesion: 0.15
Nodes (27): EmisiResumeTab(), EmissionCalculatorPage, isEmissionCalculatorEnabled, NO_SCOPE3_MONTHS, PLTSAuditBaselineTab(), FULL_MONTH_NAMES, MONTH_NAMES, PLTSMonthlyMatrixTable() (+19 more)

### Community 18 - "PLTS Performance Tabs"
Cohesion: 0.12
Nodes (31): ChartSkeleton(), TabContentSkeleton(), PLTSPerformanceAnalysis(), TabLoadVsPlts, TabProductionTarget, TABS, TabSupportingParameters, TabSystemPerformancePr (+23 more)

### Community 19 - "PLTS Summary Card"
Cohesion: 0.13
Nodes (27): PLTSSummaryCard(), SummaryCascadeToolbar(), SummaryChipsToolbar(), DATA_FRESH_THRESHOLD_MIN, DATA_STALE_THRESHOLD_MIN, extractHhMmWib(), formatDataAge(), formatNum() (+19 more)

### Community 20 - "PLTS Tab & Report Upload"
Cohesion: 0.14
Nodes (18): IsolarReportUploadCard(), monthLabel(), monthRange(), TableSkeleton(), PLTSAnalyticsSection, PLTSAuditBaselineTab, PLTSMonthlyMatrixTable, PLTSSummaryCard (+10 more)

### Community 21 - "Command & Dialog UI"
Cohesion: 0.09
Nodes (16): Command(), CommandContext, CommandDialog(), CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList (+8 more)

### Community 22 - "Solar Dashboard Service"
Cohesion: 0.14
Nodes (20): parseDashboardQuery(), DashboardServiceOptions, executeWithTiming(), fetchPlantLatestWithRetry(), fetchPltsRawData(), getCacheKey(), getPltsDashboard(), getPltsLoadDashboard() (+12 more)

### Community 23 - "Scope 2 Annual Load Analytics"
Cohesion: 0.23
Nodes (17): dynamic, GET(), FACTOR_REGISTRY_PROVENANCE, buildAutomaticSummary(), buildProjection(), detectAnomalies(), percentile(), rounded() (+9 more)

### Community 24 - "KPI Cards & Units"
Cohesion: 0.19
Nodes (11): AnalyticsMatureTable(), SummaryCardsSkeleton(), PLTSLiveStatCards(), PLTSOverviewKpis(), KpiCard(), SEMANTIC_THEMES, MetricInfoIcon(), SectionCard() (+3 more)

### Community 25 - "Load & Matrix Routes"
Cohesion: 0.19
Nodes (14): dynamic, GET(), queryObject(), dynamic, GET(), queryObject(), dynamic, GET() (+6 more)

### Community 26 - "PLTS Monthly History"
Cohesion: 0.17
Nodes (18): getGridFactor(), aggregateEntityMonth(), AggregateHistoryInput, aggregateMonthlyHistory(), buildPeriodOptions(), compactYearMonth(), DailyYieldRow, EMISSION_FACTOR_VERSION (+10 more)

### Community 27 - "Annual Report & Workbook Import"
Cohesion: 0.21
Nodes (16): buildPlantNameIndex(), detectFileType(), FILE_TYPE_PATTERNS, HEADER_TYPE_PATTERNS, importIsolarAnnualReport(), importLoadConsumption(), importRadiation(), importYield() (+8 more)

### Community 28 - "RKAP Targets"
Cohesion: 0.20
Nodes (10): importRkapTargets(), RkapTargetRepository, rowKey(), buildTargetMonthlyRows(), deriveRkapFactors(), extractObjectLiteral(), factorStats(), loadOwnerTargetMatrix() (+2 more)

### Community 29 - "Scope 2 Export"
Cohesion: 0.26
Nodes (13): dynamic, GET(), filterCanonicalRows(), normalizeText(), parseScope2Query(), buildScope2Csv(), buildScope2ExportData(), buildScope2WorkbookBytes() (+5 more)

### Community 30 - "iSolar Monthly CSV Parser"
Cohesion: 0.22
Nodes (13): decodeUtf8(), detectDelimiter(), EXPECTED_HEADERS, MISSING_MARKERS, optionalNumber(), parseCsvLine(), parseIsolarMonthlyReport(), parseIsolarMonthlyReportFile() (+5 more)

### Community 31 - "Audit & Water Recycle Routes"
Cohesion: 0.19
Nodes (9): defaultPeriod(), GET(), MONTH_SHORT, monthRange(), parsePeriod(), CANONICAL_DC_ENTITIES, PLANT_REGISTRY, PlantMetadata (+1 more)

### Community 32 - "Import Template Generator"
Cohesion: 0.32
Nodes (12): dynamic, GET(), createFacilityReferenceSheet(), createFuelReferenceSheet(), createInstructionsSheet(), generateGensetTemplate(), generatePlnTemplate(), generatePltsTemplate() (+4 more)

### Community 33 - "Annual Load Report Parser"
Cohesion: 0.28
Nodes (12): ANNUAL_LOAD_HEADER, buildScope2AnnualLoadDashboard(), MONTH_NAMES_ID, parseAnnualLoadReport(), parseCsvLine(), rounded(), summarizeRecords(), emissionFactorForPlant() (+4 more)

### Community 34 - "PLTS Summary Route"
Cohesion: 0.21
Nodes (10): dynamic, GET(), isPlantUnderConstruction(), HistoryQuery, classifyLocationStatus(), computeSummarizePlts(), MONTH_NAMES_ID, MONTH_NAMES_SHORT (+2 more)

### Community 35 - "Web Push Notifications"
Cohesion: 0.29
Nodes (8): POST(), POST(), POST(), ensureConfigured(), isPushConfigured(), removeSubscriptionByEndpoint(), saveSubscription(), sendPushToAll()

### Community 36 - "Grid Emission Factors"
Cohesion: 0.24
Nodes (7): FLAT_NATIONAL_FACTOR, GRID_EMISSION_FACTORS, getCanonicalEnergyRows(), getCanonicalMonthlySummary(), getCanonicalYtdSummary(), MONTH_NAMES_SHORT, RawEnergyFlowRow

### Community 37 - "History Repository Tests"
Cohesion: 0.20
Nodes (5): getPltsHistory(), HistoryRepository, ENTITIES, NOW, ROWS

### Community 38 - "Calculator UI Contract"
Cohesion: 0.20
Nodes (8): calculator, entryForm, factors, home, page, recap, resume, sidebar

### Community 39 - "Form Primitives"
Cohesion: 0.24
Nodes (7): FormControl, FormDescription, FormItem, FormItemContext, FormLabel, FormMessage, useFormField()

### Community 40 - "Emissions Route"
Cohesion: 0.44
Nodes (7): buildEnergyByDc(), buildMonthlyScope2Trend(), GET(), fetchRawEnergyFlows(), factorForGrid(), createPrismaHistoryRepository(), isDcLocation()

### Community 41 - "Cache Revalidation"
Cohesion: 0.36
Nodes (6): checkRateLimit(), dynamic, extractToken(), POST(), safeCompare(), PLTS_CACHE_TAG

### Community 43 - "Energy Reconciliation"
Cohesion: 0.52
Nodes (5): aggregateCanonicalRows(), finiteOrNull(), reconcilePlantMonth(), rounded(), base

### Community 44 - "PR Dashboard Route"
Cohesion: 0.47
Nodes (5): dynamic, GET(), queryObject(), getPltsPrDashboard(), getPltsPrDashboardWithTiming()

### Community 45 - "Support Dashboard Route"
Cohesion: 0.47
Nodes (5): dynamic, GET(), queryObject(), getPltsSupportDashboard(), getPltsSupportDashboardWithTiming()

### Community 46 - "PLTS Summary Dashboard Route"
Cohesion: 0.47
Nodes (5): dynamic, GET(), queryObject(), getPltsSummaryDashboard(), getPltsSummaryDashboardWithTiming()

### Community 47 - "Manual PLTS Input"
Cohesion: 0.60
Nodes (4): dynamic, finite(), POST(), invalidatePltsServerCache()

## Knowledge Gaps
- **3 isolated node(s):** `RFC-4180`, `RFC-4180`, `RFC-4180`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 360 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `isDcLocation()` connect `Emissions Route` to `iSolar Sync & Dashboard API`, `App Shell & UI Primitives`, `PLTS Summary Route`, `Grid Emission Factors`, `Inverter Temperature Pipeline`, `PLTS Analytics Config & Processor`, `Emission Resume Tab`, `PLTS Summary Card`, `Solar Dashboard Service`, `Scope 2 Annual Load Analytics`, `PLTS Monthly History`, `Audit & Water Recycle Routes`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **What connects `RFC-4180`, `RFC-4180`, `RFC-4180` to the rest of the system?**
  _3 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `iSolar Sync & Dashboard API` be split into smaller, more focused modules?**
  _Cohesion score 0.0537280701754386 - nodes in this community are weakly interconnected._
- **Why does `CANONICAL_DC_ENTITIES` connect `Audit & Water Recycle Routes` to `iSolar Sync & Dashboard API`, `App Shell & UI Primitives`, `Annual Load Report Parser`, `PLTS Summary Route`, `Grid Emission Factors`, `Inverter Temperature Pipeline`, `Emissions Route`, `PLTS Analytics Config & Processor`, `Alarm System`, `Scope 2 Annual Load Analytics`, `PLTS Monthly History`, `iSolar Monthly CSV Parser`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Should `App Shell & UI Primitives` be split into smaller, more focused modules?**
  _Cohesion score 0.06265389876880985 - nodes in this community are weakly interconnected._
- **Why does `getGridFactor()` connect `PLTS Monthly History` to `App Shell & UI Primitives`, `PLTS Summary Route`, `Grid Emission Factors`, `PLTS Analytics Config & Processor`, `Scope 2 Charts & Emission Tabs`, `PLTS Tab & Report Upload`, `Solar Dashboard Service`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Should `Emission Calculator` be split into smaller, more focused modules?**
  _Cohesion score 0.07157894736842105 - nodes in this community are weakly interconnected._