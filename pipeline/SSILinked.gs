// SSILinked.gs
// Computes SSI/SNB/TNB-related figures from the Master file's raw columns and writes them
// to a dedicated computed tab. Runs as part of the weekly PIPELINE_MAIN() job (see the
// computeSSILinked_() call in Main.gs) so it recomputes automatically every time
// Master_Monthly refreshes -- no manual export step needed downstream, ever. Writing to a
// tab rather than doing this math in a chart's own JS keeps the numbers available to any
// future view, and runs the heavier lookup/summing work once a week server-side instead of
// once per page load in every visitor's browser.
//
// Deliberately reads the already-copied destination tab via plain SpreadsheetApp calls
// (getSpreadsheet_(), same as the rest of this project's non-ingest code) rather than the
// Advanced Sheets Service used in Utils.gs's fetchSheetValues_() -- that's only needed for
// reading *other* spreadsheets (the temp converted xlsx files); this script only ever
// reads its own bound Sheet, so it needs no new OAuth scopes or advanced services beyond
// what's already enabled per SETUP.md.
//
// IMPORTANT correction (2026-08-12): the " SSI Person Race/Ethnicity - [X]" columns are
// NOT a standing count of everyone currently SSI-linked on CalFresh, despite the generic-
// sounding name -- an earlier pass here treated them as exactly that ("All SSI
// Recipients") and built a "People in SSI-Linked Households" participant total on top of
// them, which Diana caught because it came out nowhere near the ~700K statewide SSI
// population. What they actually are, confirmed against their position in the column list
// (immediately after "SSI Disposed HH Language - [X]" and right before the SNB section
// starts) and confirmed by Diana directly summing them against the neighboring total: the
// race/ethnicity breakdown of "SSI Persons in New Apps Disposed" -- i.e. a MONTHLY FLOW of
// SSI-linked persons whose CalFresh application was approved or denied that month, not a
// running stock of everyone SSI-linked. That's why the total looked so small. This tab no
// longer computes a "People in SSI-Linked Households" participant figure as a result --
// there's no valid standing total to build one from with what's in Master_Monthly today.
// The disposition-flow numbers are kept here anyway (relabeled to match their real
// meaning) because they're exactly the shape of data a future Applications Outcomes
// dashboard would want: SSI-linked application volume/outcomes compared against the
// equivalent all-applicant CF296 figures. See TODO.md's "SSI-linked persons" entry for
// the full history of this correction.
//
// Source columns (confirmed 2026-08-12 directly against Diana's own paste of the live
// Master_Monthly header row; see DATA_DICTIONARY.md and TODO.md's "SSI-linked persons"
// entry for the full derivation):
//
//   SSI Persons in New Apps    = "SSI Persons in New Apps Disposed" column, as-is -- a
//     Disposed (direct)          monthly count of SSI-linked persons whose application
//                                 was approved or denied that month (a flow, not a stock).
//   SSI Persons in New Apps    = cross-check: sum of the 9 "SSI Person Race/Ethnicity -
//     Disposed (race sum)        [X]" columns, which break down that same direct total by
//                                 race/ethnicity. Confirmed by Diana to match the direct
//                                 total -- both are recorded so any future gap (e.g. from
//                                 CDSS's <11-person suppression) is visible rather than
//                                 silently picked between.
//   SNB SSI Persons (direct)  = "Total SSI Persons in SNB Households" column, as-is. This
//                                IS a standing stock figure (current SNB household
//                                membership), unlike the disposed-applications figures
//                                above -- don't combine the two without accounting for
//                                that difference.
//   SNB SSI Persons (race sum)= cross-check: sum of the 9 "SNB SSI Person Race [X]"
//                                columns. Expected to be close to the direct total but not
//                                necessarily identical, since CDSS suppresses cells under
//                                11 people -- both values are recorded so any gap is
//                                visible rather than silently picking one.
//   TNB SSI Persons (direct)  = "Total SSI Persons in TNB Households" column, as-is --
//                                this DOES exist (an earlier pass missed it because the
//                                real header cell has a doubled space: "Total SSI  Persons
//                                in TNB Households" -- see the whitespace note below). Also
//                                a standing stock figure, like SNB's direct total.
//   TNB SSI Persons (race sum)= cross-check: sum of the 9 "TNB SSI Person Race [X]"
//                                columns, same treatment as SNB's cross-check.
//
// Which Master tab these columns actually live in (Master_Monthly vs Master_PointInTime)
// wasn't 100% pinned down from outside the live Sheet -- SSI_SOURCE_TABS below lists both
// as candidates in priority order, and locateSSIColumns_() logs exactly which tab it
// resolved against on every run. If CDSS ever renames or moves these columns, this fails
// loudly (see the logError_ in computeSSILinked_()) and skips the run rather than silently
// writing zeros.
//
// A third real bug, found 2026-08-12 after the first successful run only showed 2026
// dates: Master_Monthly's own "Date" column is silently corrupted sheet-wide. CDSS's
// source file stores it as text like "Jan-14" (meaning January 2014), but the xlsx-to-
// Sheets conversion in IngestMaster.gs auto-detects that as a date and parses it as
// day-month with no year specified -- so "14" becomes the day-of-month, and Sheets fills
// in whatever year the conversion happened to run in (2026) instead of the intended 2014.
// Confirmed directly: cell G2 in Master_Monthly *displays* "Jan-14" (format makes it look
// like the intended value) but its real underlying value is 1/14/2026, per the formula
// bar. This affects every row, not just recent ones, and isn't specific to this script --
// anything reading Master_Monthly's Date column inherits it (worth flagging more broadly;
// see TODO.md). The fix here: don't read Date at all. "Month" (text, e.g. "January") and
// "Calendar Year" (a plain number, e.g. 2014) are both unaffected by this bug, so
// buildPeriod_() reconstructs a reliable "YYYY-MM" period string from those two instead --
// this also happens to match the "YYYY-MM" convention the chart's own DATA.months array
// already uses, which will make joining this into the chart simpler later.
//
// Two real quirks in CDSS's own header row (found 2026-08-12 from Diana's direct paste of
// the live Master_Monthly columns -- this is what caused the first two runs to fail column
// resolution entirely):
//
// 1. Inconsistent whitespace. Several header cells carry stray leading/trailing/doubled
//    spaces with no visible pattern -- e.g. " SSI Person Race/Ethnicity - White" (leading
//    space), "SNB SSI Person Race Black or African American " (trailing space), "Total
//    SSI  Persons in TNB Households" (doubled internal space). Rather than hardcode every
//    quirky variant (fragile, and there's no guarantee we've seen every one), findCol_()
//    below normalizes all internal whitespace runs to a single space and trims both ends
//    before comparing, on both the header cells and our own search strings. This fixes
//    the whole class of "cell looks identical but doesn't string-match" bugs in one place.
// 2. Real spelling/wording differences, not just whitespace -- the SNB/TNB-specific race
//    breakdown columns use shorter labels for two of the nine categories than the general
//    SSI Person Race/Ethnicity columns do:
//      "Native Hawain or Pacific Islander"  vs. general "Native Hawaiian or Other Pacific
//        Islander" (missing the second "i" in Hawaiian, and missing "Other")
//      "More Than One Race"                 vs. general "More Than One Race/Ethnicity"
//        (missing the "/Ethnicity" suffix)
//    Per this project's convention (see DATA_DICTIONARY.md), column names are taken
//    verbatim rather than "corrected," so SSI_RACE_CATEGORIES_SNB_TNB below is a
//    deliberate near-duplicate of SSI_RACE_CATEGORIES for just these two entries, not a
//    typo on our part -- if a third mismatch like this turns up later, check it against
//    both lists here rather than assuming the two are still in sync.

var SSI_RACE_CATEGORIES = [
  'American Indian or Alaska Native',
  'Asian',
  'Black or African American',
  'Hispanic',
  'More Than One Race/Ethnicity',
  'Native Hawaiian or Other Pacific Islander',
  'Other',
  'Unknown',
  'White'
];

// Same 9 categories, but matching the SNB/TNB-specific columns' own (differently worded)
// labels for two categories -- see quirk #2 above. The other seven entries' wording is
// identical between the two lists.
var SSI_RACE_CATEGORIES_SNB_TNB = [
  'American Indian or Alaska Native',
  'Asian',
  'Black or African American',
  'Hispanic',
  'More Than One Race',
  'Native Hawain or Pacific Islander',
  'Other',
  'Unknown',
  'White'
];

var SSI_SOURCE_TABS = [CONFIG.TABS.MASTER_MONTHLY, CONFIG.TABS.MASTER_POINT_IN_TIME];

var SSI_COMPUTED_TAB = 'SSI_Linked_Computed';

var SSI_COMPUTED_HEADER = [
  'County', 'Period (YYYY-MM)', 'Month', 'Calendar Year',
  'SSI Persons in New Apps Disposed (direct)', 'SSI Persons in New Apps Disposed (race sum, cross-check)', 'SSI Persons in New Apps Disposed discrepancy',
  'SNB SSI Persons (direct)', 'SNB SSI Persons (race sum, cross-check)', 'SNB SSI Persons discrepancy',
  'TNB SSI Persons (direct)', 'TNB SSI Persons (race sum, cross-check)', 'TNB SSI Persons discrepancy',
  'Total SNB Households', 'SNB Avg Household Size (Aided Only)',
  'Total TNB Households', 'TNB Avg Household Size (Aided Only)'
];

var MONTH_NUMBERS_ = {
  'january': '01', 'february': '02', 'march': '03', 'april': '04',
  'may': '05', 'june': '06', 'july': '07', 'august': '08',
  'september': '09', 'october': '10', 'november': '11', 'december': '12'
};

// Builds a "YYYY-MM" period string from Master_Monthly's Month (text month name) and
// Calendar Year (plain number) columns -- deliberately NOT from the Date column, which is
// corrupted sheet-wide (see the file header comment above). Returns null if either input
// doesn't look like what's expected, so the caller can skip/flag the row instead of
// silently writing a garbage period.
function buildPeriod_(monthName, year) {
  var key = String(monthName == null ? '' : monthName).trim().toLowerCase();
  var monthNum = MONTH_NUMBERS_[key];
  var yearNum = toNumber_(year);
  if (!monthNum || !yearNum) return null;
  return yearNum + '-' + monthNum;
}

// Collapses any run of whitespace to a single space, strips any space immediately
// touching a hyphen, and trims both ends -- so header cells with stray leading/trailing/
// doubled spaces (see quirk #1 above) OR inconsistent hyphen spacing (e.g. "Exemptions-
// Care" vs "Exemptions-Care", both real column names found 2026-08-13 in the same
// "New Applications Exemptions-..." block) still match a clean search string. Applied to
// both sides of every comparison in resolveColumns_() and its equivalents in other files,
// so as long as callers use this consistently on both sides, exact spacing in either the
// header cell or the search string never matters.
function normalizeHeaderText_(s) {
  return String(s == null ? '' : s)
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .trim();
}

// The one function PIPELINE_MAIN() calls. Also safe to run manually (e.g. via
// testSSILinked() below) any time you want to force a recompute without waiting for
// Monday's trigger.
function computeSSILinked_() {
  var ss = getSpreadsheet_();

  var located = locateSSIColumns_(ss);
  if (!located) {
    logError_('SSILinked', 'Could not find the SSI/SNB/TNB source columns in any of: ' +
      SSI_SOURCE_TABS.join(', ') + '. Skipping this run\'s SSI-linked computation -- CDSS ' +
      'may have renamed or moved these columns; a human needs to check the Master tabs ' +
      'and update the column names in SSILinked.gs if so.');
    return;
  }

  var sheet = located.sheet;
  var col = located.columns;
  var allValues = sheet.getDataRange().getValues();
  var rows = allValues.slice(1); // destination tabs always have header on row 1

  var outRows = [];
  var disposedDiscrepancyCount = 0;
  var snbDiscrepancyCount = 0;
  var tnbDiscrepancyCount = 0;
  var suppressedCellCount = 0;
  var unparseablePeriodCount = 0;

  rows.forEach(function (row) {
    var county = row[col.county];
    if (!county) return; // skip blank trailing rows

    var period = buildPeriod_(row[col.month], row[col.calendarYear]);
    if (!period) {
      unparseablePeriodCount++;
      return; // can't place this row on the timeline -- skip rather than guess
    }

    var raceSumResult = sumColumns_(row, col.raceCols);
    var snbRaceSumResult = sumColumns_(row, col.snbRaceCols);
    var tnbRaceSumResult = sumColumns_(row, col.tnbRaceCols);
    suppressedCellCount += raceSumResult.suppressedCount + snbRaceSumResult.suppressedCount + tnbRaceSumResult.suppressedCount;

    var disposedDirect = toNumber_(row[col.ssiDisposedDirect]);
    var disposedRaceSum = raceSumResult.total;
    var disposedDiscrepancy = disposedDirect - disposedRaceSum;
    if (disposedDiscrepancy !== 0) disposedDiscrepancyCount++;

    var snbSsiDirect = toNumber_(row[col.snbSsiDirect]);
    var snbSsiRaceSum = snbRaceSumResult.total;
    var snbDiscrepancy = snbSsiDirect - snbSsiRaceSum;
    if (snbDiscrepancy !== 0) snbDiscrepancyCount++;

    var tnbSsiDirect = toNumber_(row[col.tnbSsiDirect]);
    var tnbSsiRaceSum = tnbRaceSumResult.total;
    var tnbDiscrepancy = tnbSsiDirect - tnbSsiRaceSum;
    if (tnbDiscrepancy !== 0) tnbDiscrepancyCount++;

    var totalSnbHh = toNumber_(row[col.totalSnbHouseholds]);
    var snbAvgSize = toNumber_(row[col.snbAvgHouseholdSize]);
    var totalTnbHh = toNumber_(row[col.totalTnbHouseholds]);
    var tnbAvgSize = toNumber_(row[col.tnbAvgHouseholdSize]);

    outRows.push([
      county, period, row[col.month], row[col.calendarYear],
      disposedDirect, disposedRaceSum, disposedDiscrepancy,
      snbSsiDirect, snbSsiRaceSum, snbDiscrepancy,
      tnbSsiDirect, tnbSsiRaceSum, tnbDiscrepancy,
      totalSnbHh, snbAvgSize,
      totalTnbHh, tnbAvgSize
    ]);
  });

  var destSheet = getOrCreateSheet_(ss, SSI_COMPUTED_TAB);
  writeRowsReplacingTab_(destSheet, SSI_COMPUTED_HEADER, outRows);

  logInfo_('SSILinked', 'Computed SSI/SNB/TNB figures for ' + outRows.length + ' row(s) from "' +
    sheet.getName() + '" -> "' + SSI_COMPUTED_TAB + '". ' + disposedDiscrepancyCount +
    ' row(s) show a nonzero gap between the direct "SSI Persons in New Apps Disposed" total ' +
    'and its race-column sum, ' + snbDiscrepancyCount + ' row(s) show the same for SNB, ' +
    tnbDiscrepancyCount + ' for TNB (expected occasionally -- CDSS suppresses cells under 11 ' +
    'people). ' + suppressedCellCount + ' individual race-breakdown cell(s) were suppressed ' +
    '("*") and treated as 0 for summing, which can understate totals slightly in counties/' +
    'months with a lot of small-cell suppression -- same open question as the general "*" ' +
    'handling noted in TODO.md. ' + unparseablePeriodCount + ' row(s) skipped for having an ' +
    'unrecognized Month/Calendar Year combination (should normally be 0 -- investigate if not). ' +
    'Reminder: the "SSI Persons in New Apps Disposed" figures are a monthly flow (applications ' +
    'processed that month), not a standing participant count -- see the file header comment ' +
    'before using them anywhere that expects a running total.');
}

// Tries each candidate tab in order, returns the first one where every required column
// name is found in its header row, plus the resolved column indexes. Logs which tab it
// used, so this is easy to confirm/audit on the very first live run rather than trusting
// it silently.
function locateSSIColumns_(ss) {
  for (var i = 0; i < SSI_SOURCE_TABS.length; i++) {
    var tabName = SSI_SOURCE_TABS[i];
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) continue;

    var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var columns = resolveColumns_(header);
    if (columns) {
      logInfo_('SSILinked', 'Resolved SSI/SNB/TNB source columns against tab "' + tabName + '".');
      return { sheet: sheet, columns: columns };
    }
  }
  return null;
}

// Returns an object of column indexes if every required column is present in this header
// row, or null if any are missing (so locateSSIColumns_ moves on to the next candidate tab).
// Matches on normalized (whitespace-collapsed, trimmed) text -- see quirk #1 in the file
// header comment -- so stray spaces in the real header cells don't break resolution.
function resolveColumns_(header) {
  var normalizedHeader = header.map(normalizeHeaderText_);

  function find(name) { return normalizedHeader.indexOf(normalizeHeaderText_(name)); }

  var idx = {
    county: find('County'),
    month: find('Month'),
    calendarYear: find('Calendar Year'),
    ssiDisposedDirect: find('SSI Persons in New Apps Disposed'),
    raceCols: SSI_RACE_CATEGORIES.map(function (cat) { return find('SSI Person Race/Ethnicity - ' + cat); }),
    snbRaceCols: SSI_RACE_CATEGORIES_SNB_TNB.map(function (cat) { return find('SNB SSI Person Race ' + cat); }),
    tnbRaceCols: SSI_RACE_CATEGORIES_SNB_TNB.map(function (cat) { return find('TNB SSI Person Race ' + cat); }),
    snbSsiDirect: find('Total SSI Persons in SNB Households'),
    tnbSsiDirect: find('Total SSI Persons in TNB Households'),
    totalSnbHouseholds: find('Total SNB Households'),
    snbAvgHouseholdSize: find('SNB Avg Household Size (Aided Only)'),
    totalTnbHouseholds: find('Total TNB Households'),
    tnbAvgHouseholdSize: find('TNB Avg Household Size (Aided Only)')
  };

  var required = [idx.county, idx.month, idx.calendarYear, idx.ssiDisposedDirect,
    idx.snbSsiDirect, idx.tnbSsiDirect,
    idx.totalSnbHouseholds, idx.snbAvgHouseholdSize, idx.totalTnbHouseholds, idx.tnbAvgHouseholdSize]
    .concat(idx.raceCols, idx.snbRaceCols, idx.tnbRaceCols);

  var missing = required.some(function (i) { return i === -1; });
  return missing ? null : idx;
}

// Sums a row's values at the given column indexes, treating CDSS's "*" small-cell
// suppression marker (see TODO.md's open item on this) and any blank/non-numeric cell as
// 0. Returns both the sum and how many cells were suppressed, so callers can log that
// distinction rather than hiding it.
function sumColumns_(row, indexes) {
  var total = 0;
  var suppressedCount = 0;
  indexes.forEach(function (i) {
    if (row[i] === '*') suppressedCount++;
    total += toNumber_(row[i]);
  });
  return { total: total, suppressedCount: suppressedCount };
}

function toNumber_(v) {
  if (v === '' || v === null || v === undefined || v === '*') return 0;
  var n = Number(v);
  return isNaN(n) ? 0 : n;
}

// Manual sanity-check entry point -- shows up in the Apps Script function picker
// alongside testDiscovery(). Run this once after pasting this file in, to confirm it
// resolves columns correctly and see the row count / discrepancy summary in Executions,
// without needing to run the full PIPELINE_MAIN job.
function testSSILinked() {
  computeSSILinked_();
  Logger.log('Done -- check the "' + SSI_COMPUTED_TAB + '" tab and the Pipeline_Log tab for details.');
}
