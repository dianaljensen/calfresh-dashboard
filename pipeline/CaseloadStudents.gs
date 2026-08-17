// CaseloadStudents.gs
// Builds a complete student reference table (County + Period, plus ~117 raw columns) from
// Master_Monthly, for future use on the Total CalFresh Participants chart and beyond.
// Runs as part of the weekly PIPELINE_MAIN() job (see the computeCaseloadStudents_() call
// in Main.gs) so it self-refreshes with no manual step, same pattern as SSILinked.gs.
//
// Working theory, not yet independently confirmed (2026-08-13): this whole column range,
// from "Applications Approved Containing at Least One Student" through the very last
// column in Master_Monthly ("Caseload Total Student Count"), may be entirely scoped to
// students -- including columns with no "student" in their own name, like "New
// Applications Gender Female" or "Caseload Race/Ethnicity Asian". That would match an
// earlier finding (TODO.md, "Master file column-naming correction," 2026-07-31): the
// "Caseload Age 17 and Under / 18 to 49 / 50 and Over" columns were confirmed to be
// students-only despite their generic-sounding name, because they summed to this same
// "Caseload Total Student Count" total. If that holds for the rest of this range too,
// "New Applications Age 17 and Under" etc. would mean "new applications with at least one
// student, broken down by age" rather than all new applications. Worth confirming before
// treating any of these as general (non-student) application/caseload figures elsewhere.
//
// Column-name quirks handled generically rather than hardcoded per-instance (same
// philosophy as SSILinked.gs): scattered whitespace inconsistencies and inconsistent
// hyphen-spacing (e.g. "Exemptions- Care" vs "Exemptions-Care", both real names in this
// same column list) are both handled by normalizeHeaderText_() in SSILinked.gs, shared
// across every .gs file in this project. Column NAME typos that look like genuine source
// quirks (not just whitespace) -- "Langugage" for one specific Farsi row, "New
// Application Asian" (singular) for one specific race row, "Black or African_American"
// with an underscore -- are preserved verbatim in STUDENT_TABLE_COLUMNS below rather than
// "corrected," per this project's convention of taking CDSS's own column names as-is.
//
// Resolution here is deliberately PARTIAL, unlike SSILinked.gs's all-or-nothing approach:
// with ~117 columns transcribed by hand, some mismatch is likely on the first pass. Rather
// than fail the whole table over one bad name, resolveStudentTableColumns_() resolves what
// it can, logs exactly which requested names didn't match (so they're easy to fix one at a
// time), and writes a table containing only the columns that did resolve. County/Month/
// Calendar Year are the exception -- those are structural (needed to place any row at all)
// and still cause a hard failure if missing, same as SSILinked.gs.
//
// Cell values are copied AS-IS (no toNumber_() coercion), unlike SSILinked.gs's sums --
// this is meant to be a complete, faithful reference table, so CDSS's own "*" small-cell
// suppression marker is preserved rather than silently turned into 0 (see the general "*"
// handling question already open in TODO.md). Expect "*" to show up more often here than
// in SSILinked.gs's totals, since these are much finer-grained slices (e.g. one language,
// one county, one month) that are more likely to fall under the <11-person threshold.

var STUDENTS_SOURCE_TABS = [CONFIG.TABS.MASTER_MONTHLY, CONFIG.TABS.MASTER_POINT_IN_TIME];

var STUDENTS_COMPUTED_TAB = 'Student_Table_Computed';

// The full column list Diana specified 2026-08-13, verbatim (whitespace normalized for
// readability here -- normalizeHeaderText_() makes exact spacing irrelevant at match time).
var STUDENT_TABLE_COLUMNS = [
  'Applications Approved Containing at Least One Student',
  'Applications Denied Containing at Least One Student',
  'Applications Pended Containing at Least One Student',
  'Applications Submitted via BenefitsCal',
  'Applications Submitted via Code for America',
  'Applications Submitted via Other Online Source',
  'Applications Submitted via Other Source',
  'Denial reason - CF Missed Interview',
  'Denial Reason - FTP Income',
  'Denial Reason - Failed to Complete Determination',
  'Denial Reason - Ineligible',
  'Denial Reason - Ineligible CF Student',
  'Denial Reason - Unavailable',
  'Denial Reason - Out of the Home',
  'Denial Reason - Over Income',
  'Denial Reason - Procedural',
  'New Applications - ICT Transfers',
  'New Applications Age 17 and Under',
  'New Applications Age 8 to 49',
  'New Applications Age 50 and Over',
  'New Applications Age Total',
  'New Applications Avg Age',
  'New Applications Gender Female',
  'New Applications Gender Male',
  'New Applications Gender Other',
  'New Applications Gender Declined_to_State',
  'New Applications Gender Total',
  'New Applications Language Armenian',
  'New Applications Language Cambodian',
  'New Applications Language Cantonese',
  'New Applications Language English',
  'New Applications Langugage Farsi',
  'New Applications Language Korean',
  'New Applications Language Mandarin',
  'New Applications Language Other',
  'New Applications Language Russian',
  'New Applications Language Spanish',
  'New Applications Language Vietnamese',
  'New Applications Language Missing',
  'New Applications Language Total',
  'New Applications American Indian Alaskan Native',
  'New Application Asian',
  'New Applications Black or African_American',
  'New Applications Hispanic',
  'New Applications More Than One Race/Ethnicity',
  'New Applications Native Hawaiian Pacific Islander',
  'New Applications Other Race/Ethnicity',
  'New Applications Unknown Race/Ethnicity',
  'New Applications White',
  'New Applications Race/Ethnicity Total',
  'New Applications Exemptions- CalFresh E&T Program',
  'New Applications Exemptions- CalGrant TANF',
  'New Applications Exemptions- CalWORKS Exempt',
  'New Applications Exemptions-Care of a Child',
  'New Applications Exemptions-Disabled',
  'New Applications Exemptions- Employment and Training Program',
  'New Applications Exemptions- Employed 20 Hours Week',
  'New Applications Exemptions- JTPA',
  'New Applications Exemptions-LPIE',
  'New Applications Exemptions-Other Employment and Training Program',
  'New Applications Exemptions-Section 236 of the Trade Act of 1974',
  'New Applications Exemptions- State or Local Government Training Program',
  'New Applications Exemptions- Title 4 Funded Employment and Training Program',
  'New Applications Exemptions- Tribal TANF',
  'New Applications Exemptions-WIOA Employment and Training Program',
  'New Applications Exemptions- Work Study',
  'Caseload ICT Applications',
  'Caseload Age 17 and Under',
  'Caseload Age 18 to 49',
  'Caseload Age 50 and Over',
  'Caseload Age Total',
  'Caseload Average Age',
  'Caseload Gender Female',
  'Caseload Gender Male',
  'Caseload Gender Other',
  'Caseload Gender Declined to State',
  'Caseload Gender Total',
  'Caseload Language Armenian',
  'Caseload Language Cambodian',
  'Caseload Language Cantonese',
  'Caseload Language English',
  'Caseload Language Farsi',
  'Caseload Language Korean',
  'Caseload Language Mandarin',
  'Caseload Language Other',
  'Caseload Language Russian',
  'Caseload Language Spanish',
  'Caseload Language Vietnamese',
  'Caseload Language Missing Data',
  'Caseload Language Total',
  'Caseload Race/Ethnicity American Indian Alaskan Native',
  'Caseload Race/Ethnicity Asian',
  'Caseload Race/Ethnicity Black or African American',
  'Caseload Race/Ethnicity Hispanic',
  'Caseload Race/Ethnicity More than one Race/Ethnicity',
  'Caseload Race/Ethnicity Native Hawaiian and Pacific Islander',
  'Caseload Race/Ethnicity Other Race/Ethnicity',
  'Caseload Race/Ethnicity Unknown',
  'Caseload Race/Ethnicity White',
  'Caseload Race/Ethnicity Total',
  'Caseload CalFresh E&T Program',
  'Caseload CalGrant TANF',
  'Caseload CalWORKS Exempt',
  'Caseload Care of a Child',
  'Caseload Disabled',
  'Caseload Employment and Training Program',
  'Caseload Employed 20 Hours/Week',
  'Caseload JTPA',
  'Caseload LPIE',
  'Caseload Other Employment and Training Program',
  'Caseload Section 236 of the Trade Act of 1974',
  'Caseload State or Local Government Training Program',
  'Caseload Title 4 Funded Employment and Training Program',
  'Caseload Tribal TANF',
  'Caseload WIOA Employment and Training Program',
  'Caseload Work Study',
  'Caseload Total Student Count'
];

// The one function PIPELINE_MAIN() calls. Also safe to run manually (e.g. via
// testCaseloadStudents() below) any time you want to force a recompute.
function computeCaseloadStudents_() {
  var ss = getSpreadsheet_();

  var located = locateStudentTableColumns_(ss);
  if (!located) {
    logError_('CaseloadStudents', 'Could not find County/Month/Calendar Year in any of: ' +
      STUDENTS_SOURCE_TABS.join(', ') + '. Skipping this run -- these are structural ' +
      'columns needed to place any row at all, unlike the ~117 data columns below (which ' +
      'resolve partially). A human needs to check the Master tabs.');
    return;
  }

  if (located.missing.length) {
    logWarn_('CaseloadStudents', located.missing.length + ' of ' + STUDENT_TABLE_COLUMNS.length +
      ' requested column(s) were not found in "' + located.sheet.getName() + '" and will be ' +
      'left out of "' + STUDENTS_COMPUTED_TAB + '" this run -- likely a transcription mismatch ' +
      'rather than a real absence, given how many similar columns nearby did resolve. Missing: ' +
      located.missing.join(' | '));
  }

  var sheet = located.sheet;
  var struct = located.structural;
  var dataColumns = located.dataColumns; // [{ name, index }, ...] -- only the resolved ones
  var allValues = sheet.getDataRange().getValues();
  var rows = allValues.slice(1); // destination tabs always have header on row 1

  var header = ['County', 'Period (YYYY-MM)', 'Month', 'Calendar Year']
    .concat(dataColumns.map(function (c) { return c.name; }));

  var outRows = [];
  var unparseablePeriodCount = 0;

  rows.forEach(function (row) {
    var county = row[struct.county];
    if (!county) return; // skip blank trailing rows

    var period = buildPeriod_(row[struct.month], row[struct.calendarYear]);
    if (!period) {
      unparseablePeriodCount++;
      return; // can't place this row on the timeline -- skip rather than guess
    }

    var values = dataColumns.map(function (c) { return row[c.index]; }); // raw, no coercion -- see file header
    outRows.push([county, period, row[struct.month], row[struct.calendarYear]].concat(values));
  });

  var destSheet = getOrCreateSheet_(ss, STUDENTS_COMPUTED_TAB);
  writeRowsReplacingTab_(destSheet, header, outRows);

  logInfo_('CaseloadStudents', 'Built the student reference table: ' + outRows.length +
    ' row(s), ' + dataColumns.length + ' of ' + STUDENT_TABLE_COLUMNS.length +
    ' requested data column(s) resolved, from "' + sheet.getName() + '" -> "' +
    STUDENTS_COMPUTED_TAB + '". ' + unparseablePeriodCount + ' row(s) skipped for having an ' +
    'unrecognized Month/Calendar Year combination (should normally be 0 -- investigate if ' +
    'not). Cell values are copied as-is, including CDSS\'s "*" small-cell suppression marker ' +
    'where present -- expect it more often here than in SSILinked.gs\'s totals, since these ' +
    'are much finer-grained slices.');
}

// Tries each candidate tab in order. Structural columns (County/Month/Calendar Year) must
// all be present for a tab to qualify at all; the ~117 data columns resolve partially --
// whatever's found is returned alongside a list of what wasn't, rather than failing the
// whole tab over one mismatched name.
function locateStudentTableColumns_(ss) {
  for (var i = 0; i < STUDENTS_SOURCE_TABS.length; i++) {
    var tabName = STUDENTS_SOURCE_TABS[i];
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) continue;

    var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var normalizedHeader = header.map(normalizeHeaderText_);
    function find(name) { return normalizedHeader.indexOf(normalizeHeaderText_(name)); }

    var structural = { county: find('County'), month: find('Month'), calendarYear: find('Calendar Year') };
    if (structural.county === -1 || structural.month === -1 || structural.calendarYear === -1) {
      continue; // try the next candidate tab
    }

    var dataColumns = [];
    var missing = [];
    STUDENT_TABLE_COLUMNS.forEach(function (name) {
      var idx = find(name);
      if (idx === -1) missing.push(name);
      else dataColumns.push({ name: name, index: idx });
    });

    logInfo_('CaseloadStudents', 'Resolved structural columns against tab "' + tabName + '".');
    return { sheet: sheet, structural: structural, dataColumns: dataColumns, missing: missing };
  }
  return null;
}

// Manual sanity-check entry point -- shows up in the Apps Script function picker
// alongside testDiscovery() and testSSILinked(). Run this once after pasting this file
// in (or after updating it), to confirm resolution and see the row/column-match summary
// in Executions, without needing to run the full PIPELINE_MAIN job.
function testCaseloadStudents() {
  computeCaseloadStudents_();
  Logger.log('Done -- check the "' + STUDENTS_COMPUTED_TAB + '" tab and the Pipeline_Log tab for details.');
}
