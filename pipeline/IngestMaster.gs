// IngestMaster.gs
// Handles the single always-current "CalFresh Data Dashboard Raw Data" Excel file.
// Unlike CF296/CF18, this isn't per-fiscal-year — it's one evolving file — so each
// run does a full replace of its five destination tabs rather than an append/upsert.
//
// Reads out of the temp converted file use fetchSheetValues_ (read-only Sheets API),
// not SpreadsheetApp.openById(tempId) — see the comment on that function in Utils.gs
// for why: it's what lets this script run under a narrow 'spreadsheets.readonly' +
// 'spreadsheets.currentonly' scope pair instead of full edit/delete access to every
// Sheet in the account.

function ingestDashboardMaster_(fileInfo) {
  var tempId = null;
  try {
    var blob = fetchBlob_(fileInfo.url);
    tempId = convertXlsxBlobToTempSpreadsheet_(blob, 'TEMP_dashboard_master_' + new Date().getTime());
    var ss = getSpreadsheet_();

    copyMasterTab_(tempId, CONFIG.SOURCE_TABS.MONTHLY, CONFIG.TABS.MASTER_MONTHLY);
    copyMasterTab_(tempId, CONFIG.SOURCE_TABS.POINT_IN_TIME, CONFIG.TABS.MASTER_POINT_IN_TIME);
    copyMasterTab_(tempId, CONFIG.SOURCE_TABS.QUARTERLY, CONFIG.TABS.MASTER_QUARTERLY);
    copyMasterTab_(tempId, CONFIG.SOURCE_TABS.ANNUAL, CONFIG.TABS.MASTER_ANNUAL);
    copyMasterTab_(tempId, CONFIG.SOURCE_TABS.PRI, CONFIG.TABS.MASTER_PRI);

    // The 'Updates' tab is CDSS's own changelog — copy it verbatim (it's tiny, and it's
    // genuinely useful context for anyone using this data to know what shifted when).
    copyRawTab_(tempId, CONFIG.SOURCE_TABS.UPDATES, CONFIG.TABS.MASTER_UPDATES);

    logInfo_('Master', 'Ingested dashboard master file (updated ' + fileInfo.updatedText + ') from ' + fileInfo.url);
  } finally {
    if (tempId) deleteTempFile_(tempId);
  }
}

// Reads a header-row-2 / data-from-row-3 tab (Monthly, Point in Time, Quarterly,
// Annual, PRI all follow this exact layout) and replaces the matching destination tab.
function copyMasterTab_(tempId, sourceTabName, destTabName) {
  var allValues;
  try {
    allValues = fetchSheetValues_(tempId, sourceTabName);
  } catch (e) {
    logWarn_('Master', 'Could not read tab "' + sourceTabName + '" from the source file (' + e + ') — skipping. CDSS may have renamed a tab.');
    return;
  }

  if (allValues.length < CONFIG.MASTER_DATA_START_ROW) {
    logWarn_('Master', 'Tab "' + sourceTabName + '" has no data rows below the expected header row — skipping.');
    return;
  }

  var header = allValues[CONFIG.MASTER_HEADER_ROW - 1];
  var data = allValues.slice(CONFIG.MASTER_DATA_START_ROW - 1);

  var destSheet = getOrCreateSheet_(getSpreadsheet_(), destTabName);
  writeRowsReplacingTab_(destSheet, header, data);
}

// Verbatim copy, no header-row assumptions — used for the small 'Updates' changelog tab.
function copyRawTab_(tempId, sourceTabName, destTabName) {
  var allValues;
  try {
    allValues = fetchSheetValues_(tempId, sourceTabName);
  } catch (e) {
    logWarn_('Master', 'Could not read tab "' + sourceTabName + '" (' + e + ') — skipping.');
    return;
  }
  if (allValues.length === 0) return;

  var destSheet = getOrCreateSheet_(getSpreadsheet_(), destTabName);
  destSheet.clearContents();
  destSheet.getRange(1, 1, allValues.length, allValues[0].length).setValues(allValues);
}
