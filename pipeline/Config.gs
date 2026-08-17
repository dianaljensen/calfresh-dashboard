// Config.gs
// All the constants that describe *where things live* and *what the policy is*.
// If a CDSS URL changes, or you want to change the retention window, this is the only
// file that should need touching for those kinds of changes.

var CONFIG = {
  // The consolidated Google Sheet this pipeline writes into.
  SHEET_ID: '15Gl0slpu-aeWNfsNfteVEL5qAI_DQmFgdEVCpBfA3W4',

  // The Drive folder everything lives in (used as the parent for temporary
  // conversion files, which are always deleted after use).
  FOLDER_ID: '1JIIKuuA8br_zG7frF06OCn7h-iIj62Nd',

  // --- CDSS source pages ---
  DASHBOARD_PAGE_URL: 'https://www.cdss.ca.gov/inforesources/data-portal/research-and-data/calfresh-data-dashboard',
  // Fallback used only if we can't parse the link off the page above (see SourceDiscovery.gs).
  DASHBOARD_XLSX_FALLBACK_URL: 'https://www.cdss.ca.gov/Portals/9/Additional-Resources/Research-and-Data/DSSDS/Master%20data%20PUBLIC%20ACCESSIBLE.xlsx',

  CF296_LISTING_URL: 'https://www.cdss.ca.gov/inforesources/research-and-data/calfresh-data-tables/cf296',
  CF18_LISTING_URL: 'https://www.cdss.ca.gov/inforesources/data-portal/research-and-data/calfresh-data-tables/cf-18',

  // --- Tab names in the consolidated Sheet ---
  TABS: {
    MASTER_MONTHLY: 'Master_Monthly',
    MASTER_POINT_IN_TIME: 'Master_PointInTime',
    MASTER_QUARTERLY: 'Master_Quarterly',
    MASTER_ANNUAL: 'Master_Annual',
    MASTER_PRI: 'Master_PRI',
    MASTER_UPDATES: 'Master_Updates',
    CF296: 'CF296',
    CF296_LEGACY: 'CF296_Legacy', // pre-FY2020-21 format: different tab, different columns — see IngestCF.gs
    CF18: 'CF18',
    LOG: 'Pipeline_Log'
  },

  // --- Tab names inside the *source* xlsx files, once converted (Master file only —
  // CF296/CF18's source tab names vary by year and are handled by the variant lists
  // in IngestCF.gs instead) ---
  SOURCE_TABS: {
    MONTHLY: 'Monthly',
    POINT_IN_TIME: 'Point in Time',
    QUARTERLY: 'Quarterly',
    ANNUAL: 'Annual',
    PRI: 'PRI',
    UPDATES: 'Updates'
  },

  // Header row / data-start row for the Master dashboard file, confirmed 2026-07-16.
  MASTER_HEADER_ROW: 2,
  MASTER_DATA_START_ROW: 3,

  // CF296/CF18 header row and "Cell N" start column are NOT fixed constants — CDSS has
  // changed both across the years these reports have been posted (confirmed 2026-07-16,
  // see README's Key Decisions Log), so IngestCF.gs auto-detects them per file via the
  // CF296_VARIANTS / CF18_VARIANTS lists in that file instead of using hardcoded values here.

  // --- Retention policy (see README.md "Retention Policy" for the reasoning) ---
  RETENTION_YEARS: 25,
  CELL_SAFETY_THRESHOLD: 8000000, // 80% of Google Sheets' 10M-cell cap

  // --- Execution-time safety ---
  // Apps Script hard-caps a single execution at 6 minutes regardless of account type.
  // We stop starting new work after this many milliseconds and schedule a continuation
  // trigger instead, so we never get killed mid-write.
  TIME_BUDGET_MS: 4.5 * 60 * 1000,

  // How soon a continuation run fires after we voluntarily stop early.
  CONTINUATION_DELAY_MINUTES: 3,

  // How many times to retry a job that fails with what looks like a transient Google
  // server error (502s, "Service Spreadsheets failed", etc — seen twice during the
  // 2026-07-16 backfill, both resolved on a plain retry) before giving up on it and
  // logging a permanent failure.
  MAX_JOB_ATTEMPTS: 3
};
