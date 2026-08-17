// Retention.gs
// Two safeguards described in README.md: a rolling N-year window (CONFIG.RETENTION_YEARS),
// and a hard safety valve that prunes the single oldest year from the largest tabs if
// total cell usage ever creeps past CONFIG.CELL_SAFETY_THRESHOLD, no matter why.
// Every prune this file does gets written to Pipeline_Log with the exact row counts
// and years removed — nothing here should ever be a silent data loss.

// date column index is 0-based, within the tab's own data range (not counting header row).
var RETENTION_TARGETS = [
  { tab: 'MASTER_MONTHLY', dateCol: 6 },   // 'Date' is the 7th column in Master_Monthly
  { tab: 'CF296', dateCol: 0 },            // 'Date' is the 1st column in CF296/CF18/CF296_Legacy
  { tab: 'CF296_LEGACY', dateCol: 0 },
  { tab: 'CF18', dateCol: 0 }
];

function enforceRetention_() {
  var ss = getSpreadsheet_();
  var cutoff = yearsAgo_(CONFIG.RETENTION_YEARS);

  RETENTION_TARGETS.forEach(function (target) {
    var sheetName = CONFIG.TABS[target.tab];
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;
    var removed = pruneRowsOlderThan_(sheet, target.dateCol, cutoff);
    if (removed > 0) {
      logInfo_('Retention', 'Pruned ' + removed + ' row(s) older than ' + cutoff.toDateString() + ' from ' + sheetName + ' (rolling ' + CONFIG.RETENTION_YEARS + '-year window).');
    }
  });

  enforceSafetyValve_();
}

function enforceSafetyValve_() {
  var ss = getSpreadsheet_();
  var total = computeTotalCellCount_(ss);
  var guard = 0;

  while (total > CONFIG.CELL_SAFETY_THRESHOLD && guard < 50) {
    guard++;
    var droppedSomething = false;

    for (var i = 0; i < RETENTION_TARGETS.length; i++) {
      var target = RETENTION_TARGETS[i];
      var sheetName = CONFIG.TABS[target.tab];
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet || sheet.getLastRow() < 2) continue;

      var result = dropOldestYearFromTab_(sheet, target.dateCol);
      if (result.removed > 0) {
        logWarn_('Retention', 'SAFETY VALVE: total cell usage (' + total + ') exceeded the ' +
          CONFIG.CELL_SAFETY_THRESHOLD + '-cell threshold. Dropped ' + result.removed +
          ' row(s) from calendar year ' + result.year + ' in ' + sheetName +
          ' to stay under the cap. Update README.md\'s Key Decisions Log with this event.');
        droppedSomething = true;
        break; // recompute total before deciding whether to drop more
      }
    }

    if (!droppedSomething) break; // nothing left we're willing to prune
    total = computeTotalCellCount_(ss);
  }
}

function pruneRowsOlderThan_(sheet, dateColIdx, cutoffDate) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return 0;

  var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  var kept = data.filter(function (r) {
    var d = parseDateSafe_(r[dateColIdx]);
    return !d || d >= cutoffDate; // keep anything we can't parse, rather than silently drop it
  });

  var removed = data.length - kept.length;
  if (removed > 0) {
    writeRowsReplacingTab_(sheet, header, kept);
  }
  return removed;
}

function dropOldestYearFromTab_(sheet, dateColIdx) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return { removed: 0, year: null };

  var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  var minYear = null;
  data.forEach(function (r) {
    var d = parseDateSafe_(r[dateColIdx]);
    if (d) {
      var y = d.getFullYear();
      if (minYear === null || y < minYear) minYear = y;
    }
  });
  if (minYear === null) return { removed: 0, year: null };

  var kept = data.filter(function (r) {
    var d = parseDateSafe_(r[dateColIdx]);
    return !d || d.getFullYear() !== minYear;
  });

  var removed = data.length - kept.length;
  if (removed > 0) {
    writeRowsReplacingTab_(sheet, header, kept);
  }
  return { removed: removed, year: minYear };
}
