// Participation.gs
// OPTIONAL / unused by the live dashboard as of 2026-08-22. The participation view
// fetches published Master_Monthly / Master_Annual / Master_PointInTime CSVs
// directly (data.js). This file would build slimmer computed tabs if that ~6 MB
// monthly CSV ever becomes too slow to load in the browser.
//
// Builds two slim computed tabs the public dashboard fetches, instead of pulling
// Master_Monthly wholesale (~300 columns / ~2.7M cells — too large for the gviz CSV
// endpoint, and full of columns this view doesn't use).
//
//   Participation_Computed  — one row per county per month, with only the columns
//                             the participation view charts: persons, households,
//                             child-only, dual Medi-Cal, students, dollars issued.
//   AgeBands_Computed       — one row per county per July, from Master_Annual's
//                             real caseload age breakdown (NOT the Master_Monthly
//                             "Caseload Age" columns, which are students-only —
//                             see TODO.md's "Master file column-naming correction").
//
// Same self-refresh pattern as SSILinked.gs / CaseloadStudents.gs, if we ever
// turn this on: PIPELINE_MAIN() would call computeParticipation_() after ingest.
// a manual export. The frontend reads them through the WebApi.gs doGet() feed
// (not gviz) because the spreadsheet itself is in a Google Workspace Drive that
// currently returns 401 to anonymous gviz/pub requests.
//
// Periods are rebuilt from Month + Calendar Year, never from the Date column —
// that column is silently corrupted sheet-wide (see SSILinked.gs / TODO.md).
// Column-name matching uses normalizeHeaderText_() so CDSS's inconsistent
// whitespace doesn't break resolution.
//
// Values are copied as nullable numbers: CDSS's "*" small-cell suppression marker
// and blank cells become empty (not 0), so the chart can render an honest gap
// instead of a fake zero. Feb 2019 / Sonoma Apr 2019 gap-nulling is applied later,
// in the frontend, so this tab stays a faithful extract of what CDSS reported.

var PARTICIPATION_SOURCE_TABS = [CONFIG.TABS.MASTER_MONTHLY];
var PARTICIPATION_COMPUTED_TAB = 'Participation_Computed';
var AGE_BANDS_COMPUTED_TAB = 'AgeBands_Computed';

// Requested data columns, in the order they appear on Participation_Computed.
// Structural County/Month/Calendar Year are required; these resolve independently
// (same partial-resolution approach as CaseloadStudents.gs) so a renamed overlay
// column doesn't block the whole feed.
var PARTICIPATION_DATA_COLUMNS = [
  { key: 'persons', name: 'CalFresh Persons' },
  { key: 'households', name: 'CalFresh Households' },
  { key: 'child_only', name: 'Persons in Child-Only Households' },
  { key: 'dual_medi_cal', name: 'CalFresh Persons Receiving Medi-Cal' },
  { key: 'dollars_issued', name: 'Total Issuances' },
  { key: 'students', name: 'Caseload Total Student Count' }
];

var AGE_BAND_COLUMNS = [
  { key: 'elderly', names: ['Elderly CalFresh July', 'Elderly CalFresh'] },
  { key: 'a1859', names: ['Age 18 to 59 CalFresh July', 'Age 18 to 59 CalFresh'] },
  { key: 'children', names: ['Children CalFresh July', 'Children CalFresh'] }
];

var PARTICIPATION_COMPUTED_HEADER = [
  'County', 'Period (YYYY-MM)', 'Month', 'Calendar Year',
  'CalFresh Persons', 'CalFresh Households',
  'Persons in Child-Only Households', 'CalFresh Persons Receiving Medi-Cal',
  'Total Issuances', 'Caseload Total Student Count'
];

var AGE_BANDS_COMPUTED_HEADER = [
  'County', 'Period (YYYY-MM)',
  'Elderly CalFresh July', 'Age 18 to 59 CalFresh July', 'Children CalFresh July'
];

function computeParticipation_() {
  computeParticipationMonthly_();
  computeAgeBands_();
}

function computeParticipationMonthly_() {
  var ss = getSpreadsheet_();
  var located = locateParticipationColumns_(ss);
  if (!located) {
    logError_('Participation', 'Could not find County/Month/Calendar Year in any of: ' +
      PARTICIPATION_SOURCE_TABS.join(', ') + '. Skipping this run — a human needs to check the Master tabs.');
    return;
  }

  if (located.missing.length) {
    logWarn_('Participation', located.missing.length + ' requested column(s) were not found in "' +
      located.sheet.getName() + '" and will be left blank on "' + PARTICIPATION_COMPUTED_TAB +
      '" this run: ' + located.missing.join(' | '));
  }

  var sheet = located.sheet;
  var struct = located.structural;
  var colByKey = located.colByKey;
  var allValues = sheet.getDataRange().getValues();
  var rows = allValues.slice(1);

  var outRows = [];
  var unparseablePeriodCount = 0;

  rows.forEach(function (row) {
    var county = normalizeCountyName_(row[struct.county]);
    if (!county) return;

    var period = buildPeriod_(row[struct.month], row[struct.calendarYear]);
    if (!period) {
      unparseablePeriodCount++;
      return;
    }

    outRows.push([
      county,
      period,
      row[struct.month],
      row[struct.calendarYear],
      nullableFromRow_(row, colByKey.persons),
      nullableFromRow_(row, colByKey.households),
      nullableFromRow_(row, colByKey.child_only),
      nullableFromRow_(row, colByKey.dual_medi_cal),
      nullableFromRow_(row, colByKey.dollars_issued),
      nullableFromRow_(row, colByKey.students)
    ]);
  });

  var destSheet = getOrCreateSheet_(ss, PARTICIPATION_COMPUTED_TAB);
  writeRowsReplacingTab_(destSheet, PARTICIPATION_COMPUTED_HEADER, outRows);
  PropertiesService.getScriptProperties().setProperty('participationGeneratedAt', new Date().toISOString());

  logInfo_('Participation', 'Built "' + PARTICIPATION_COMPUTED_TAB + '": ' + outRows.length +
    ' row(s) from "' + sheet.getName() + '". ' + unparseablePeriodCount +
    ' row(s) skipped for an unrecognized Month/Calendar Year combination (should normally be 0).');
}

function computeAgeBands_() {
  var ss = getSpreadsheet_();
  var annual = ss.getSheetByName(CONFIG.TABS.MASTER_ANNUAL);
  if (!annual) {
    logWarn_('Participation', 'No "' + CONFIG.TABS.MASTER_ANNUAL + '" tab — skipping ' +
      AGE_BANDS_COMPUTED_TAB + '. Age-group overlay on the chart will be empty until this exists.');
    return;
  }

  var header = annual.getRange(1, 1, 1, annual.getLastColumn()).getValues()[0];
  var normalizedHeader = header.map(normalizeHeaderText_);
  function find(name) { return normalizedHeader.indexOf(normalizeHeaderText_(name)); }
  function findAny(names) {
    for (var i = 0; i < names.length; i++) {
      var idx = find(names[i]);
      if (idx !== -1) return idx;
    }
    return -1;
  }

  var countyIdx = find('County');
  var yearIdx = find('Calendar Year');
  if (yearIdx === -1) yearIdx = find('Year');
  var monthIdx = find('Month');

  if (countyIdx === -1 || yearIdx === -1) {
    logError_('Participation', 'Could not find County + Calendar Year (or Year) on "' +
      CONFIG.TABS.MASTER_ANNUAL + '" — skipping age-band computation.');
    return;
  }

  var colByKey = {};
  var missing = [];
  AGE_BAND_COLUMNS.forEach(function (c) {
    var idx = findAny(c.names);
    if (idx === -1) missing.push(c.names[0]);
    else colByKey[c.key] = idx;
  });
  if (missing.length) {
    logWarn_('Participation', 'Age-band column(s) not found on Master_Annual: ' + missing.join(' | '));
  }

  var rows = annual.getDataRange().getValues().slice(1);
  var outRows = [];
  var skipped = 0;

  rows.forEach(function (row) {
    var county = normalizeCountyName_(row[countyIdx]);
    if (!county) return;

    // Annual age bands are a July snapshot. If a Month column exists, keep July
    // only; otherwise treat each year-row as that year's July reading.
    if (monthIdx !== -1) {
      var monthKey = String(row[monthIdx] == null ? '' : row[monthIdx]).trim().toLowerCase();
      if (monthKey && monthKey !== 'july' && monthKey !== '07' && monthKey !== '7') {
        return;
      }
    }

    var yearNum = yearFromCell_(row[yearIdx]);
    if (!yearNum) {
      skipped++;
      return;
    }
    var period = yearNum + '-07';

    outRows.push([
      county,
      period,
      nullableFromRow_(row, colByKey.elderly),
      nullableFromRow_(row, colByKey.a1859),
      nullableFromRow_(row, colByKey.children)
    ]);
  });

  var destSheet = getOrCreateSheet_(ss, AGE_BANDS_COMPUTED_TAB);
  writeRowsReplacingTab_(destSheet, AGE_BANDS_COMPUTED_HEADER, outRows);

  logInfo_('Participation', 'Built "' + AGE_BANDS_COMPUTED_TAB + '": ' + outRows.length +
    ' row(s) from "' + CONFIG.TABS.MASTER_ANNUAL + '". ' + skipped +
    ' row(s) skipped for an unrecognized year.');
}

function locateParticipationColumns_(ss) {
  for (var i = 0; i < PARTICIPATION_SOURCE_TABS.length; i++) {
    var tabName = PARTICIPATION_SOURCE_TABS[i];
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) continue;

    var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var normalizedHeader = header.map(normalizeHeaderText_);
    function find(name) { return normalizedHeader.indexOf(normalizeHeaderText_(name)); }

    var structural = { county: find('County'), month: find('Month'), calendarYear: find('Calendar Year') };
    if (structural.county === -1 || structural.month === -1 || structural.calendarYear === -1) {
      continue;
    }

    var colByKey = {};
    var missing = [];
    PARTICIPATION_DATA_COLUMNS.forEach(function (c) {
      var idx = find(c.name);
      if (idx === -1) missing.push(c.name);
      else colByKey[c.key] = idx;
    });

    logInfo_('Participation', 'Resolved structural columns against tab "' + tabName + '".');
    return { sheet: sheet, structural: structural, colByKey: colByKey, missing: missing };
  }
  return null;
}

function normalizeCountyName_(name) {
  var s = String(name == null ? '' : name).trim();
  if (!s) return '';
  var key = s.toLowerCase();
  if (key === 'statewide' || key === 'california' || key === 'ca' ||
      key === 'state' || key === 'state total' || key === 'california (statewide)' ||
      key === 'california statewide') {
    return 'Statewide';
  }
  return s;
}

// Empty string (not 0, not null) so writeRowsReplacingTab_ can setValues() without
// type complaints, and the frontend can treat blank as "no reading."
function nullableFromRow_(row, idx) {
  if (idx === undefined || idx === -1) return '';
  return toNullableNumber_(row[idx]);
}

function toNullableNumber_(v) {
  if (v === '' || v === null || v === undefined || v === '*') return '';
  if (typeof v === 'number') return isNaN(v) ? '' : v;
  var n = Number(String(v).replace(/,/g, '').trim());
  return isNaN(n) ? '' : n;
}

function yearFromCell_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) {
    return v.getFullYear();
  }
  var n = toNumber_(v);
  return n || null;
}

function testParticipation() {
  computeParticipation_();
  Logger.log('Done — check the "' + PARTICIPATION_COMPUTED_TAB + '" and "' +
    AGE_BANDS_COMPUTED_TAB + '" tabs and the Pipeline_Log tab for details.');
}
