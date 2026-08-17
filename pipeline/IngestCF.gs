// IngestCF.gs
//
// CDSS has changed CF296's file format over the years this report has been posted.
// Rather than one hardcoded layout, each report has a list of known "variants" (tab
// name, header-row search window, how "Cell N" columns are labeled, which metadata
// columns exist), tried in order. Built from real files, not guessed - see README's
// Key Decisions Log, 2026-07-16 entries, for the full trail. This took two attempts:
// the first assumed 'dataExternalLegacy' shared the current era's 135-item schema,
// which turned out to be wrong once tested live.
//
//   'current'            FY2025-26+           : Data_External tab, header row 6,
//                                                "Cell 1".."Cell 135" (135 metrics)
//   'dataExternalLegacy'  FY2020-21..FY2024-25 : Data_External tab, header row 5,
//                                                bare "1".."123" (123 metrics, NOT 135)
//   'finalData'           FY2016-17..FY2019-20 : FinalData tab, header row 5, bare
//                                                "1".."123", different metadata columns
//                                                (no County Code, no Report Month)
//
// 'dataExternalLegacy' and 'finalData' turned out to share the same 123 items in the
// same order (confirmed by comparing item text - e.g. both label item 2 "1A. Online
// applications received during the month" verbatim), just wrapped in a different tab
// name and metadata-column convention. Both write into the same CF296_Legacy tab using
// the same CF296_LABELS_LEGACY dictionary. Only 'current' (135 metrics, the newest year)
// is genuinely a different schema, written to its own CF296 tab. If CF296 changes
// format again, add a new variant here rather than rewriting this file.

var CF296_VARIANTS = [
  {
    name: 'current',
    tabName: 'Data_External',
    headerRowSearch: [6, 5, 7],
    cellLabelPattern: /^Cell\s*\d+$/i,
    metadataCols: { date: 0, county: 1, countyCode: 3, sfy: 4, ffy: 5, reportMonth: 6 },
    labelsKey: 'current',
    targetTab: 'CF296'
  },
  {
    name: 'dataExternalLegacy',
    tabName: 'Data_External',
    headerRowSearch: [5, 6, 4],
    cellLabelPattern: /^\d+$/,
    metadataCols: { date: 0, county: 1, countyCode: 3, sfy: 4, ffy: 5, reportMonth: 6 },
    labelsKey: 'legacy',
    targetTab: 'CF296_LEGACY'
  },
  {
    name: 'finalData',
    tabName: 'FinalData',
    headerRowSearch: [5, 4, 6],
    cellLabelPattern: /^\d+$/,
    metadataCols: { date: 0, county: 3, sfy: 4, ffy: 5 }, // no countyCode, no reportMonth
    labelsKey: 'legacy',
    targetTab: 'CF296_LEGACY'
  }
];

var CF18_VARIANTS = [
  {
    name: 'current',
    tabName: 'Data_Internal',
    headerRowSearch: [6, 5, 7],
    cellLabelPattern: /^Cell\s*\d+$/i,
    metadataCols: { date: 0, county: 1, countyCode: 3, sfy: 4, ffy: 5, reportMonth: 6 },
    labelsKey: 'current',
    targetTab: 'CF18'
  }
  // No format drift found across CF18's 6 available fiscal years (2020-21 through
  // 2025-26) as of the 2026-07-16 backfill. If a future backfill of an older CF18 year
  // (should CDSS ever post one) fails, add a variant here the same way CF296 has one.
];

// Finds which known variant (if any) matches this file, and where its header row
// actually is. Tries each variant's tab name in order; for the first one present,
// searches its headerRowSearch window for whichever row has the most cells matching
// its cellLabelPattern — that's almost certainly the real header row.
function findVariantAndHeader_(tempId, variants) {
  var tabNames = listSheetTabs_(tempId);

  for (var i = 0; i < variants.length; i++) {
    var variant = variants[i];
    if (tabNames.indexOf(variant.tabName) === -1) continue;

    var allValues = fetchSheetValues_(tempId, variant.tabName);
    var bestCount = 0, bestRowIdx = -1, bestStartCol = -1;

    variant.headerRowSearch.forEach(function (rowNum) {
      var rowIdx = rowNum - 1;
      if (rowIdx < 0 || rowIdx >= allValues.length) return;
      var row = allValues[rowIdx];
      var count = 0, startCol = -1;
      for (var c = 0; c < row.length; c++) {
        var v = row[c];
        if (v !== '' && v !== null && v !== undefined && variant.cellLabelPattern.test(String(v).trim())) {
          if (startCol === -1) startCol = c;
          count++;
        }
      }
      if (count > bestCount) {
        bestCount = count;
        bestRowIdx = rowIdx;
        bestStartCol = startCol;
      }
    });

    if (bestCount > 0) {
      return {
        variant: variant,
        allValues: allValues,
        dataStartIdx: bestRowIdx + 1,
        cellStartCol: bestStartCol,
        detectedCellCount: bestCount
      };
    }
  }
  return null;
}

function ingestCFFiscalYearGeneric_(fileInfo, variants, labelsMap, sourceName) {
  var tempId = null;
  try {
    var blob = fetchBlob_(fileInfo.url);
    tempId = convertXlsxBlobToTempSpreadsheet_(blob, 'TEMP_' + sourceName + '_' + (fileInfo.fiscalYear || 'unknown') + '_' + new Date().getTime());

    var found = findVariantAndHeader_(tempId, variants);
    if (!found) {
      var triedTabs = variants.map(function (v) { return v.tabName; }).join(', ');
      logError_(sourceName, 'None of the known layouts (tried tabs: ' + triedTabs + ') matched ' + fileInfo.url +
        ' — skipping. This fiscal year likely needs a new variant added to IngestCF.gs.');
      return;
    }

    var variant = found.variant;
    var labelsArray = labelsMap[variant.labelsKey] || [];
    var useLabels = labelsArray;
    var labelsOk = assertLabelCountMatches_(sourceName + ' (' + variant.name + ')', labelsArray.length, found.detectedCellCount);
    if (!labelsOk) {
      useLabels = [];
      for (var c = 1; c <= found.detectedCellCount; c++) useLabels.push('Cell ' + c);
    }

    var dataRows = found.allValues.slice(found.dataStartIdx);
    var m = variant.metadataCols;
    var fyLabel = fileInfo.fiscalYear || 'unknown';

    var newRows = dataRows.map(function (r) {
      var fixedBase = [
        m.date !== undefined ? r[m.date] : '',
        m.county !== undefined ? r[m.county] : '',
        m.countyCode !== undefined ? r[m.countyCode] : '',
        m.sfy !== undefined ? r[m.sfy] : '',
        m.ffy !== undefined ? r[m.ffy] : '',
        m.reportMonth !== undefined ? r[m.reportMonth] : ''
      ];
      var cells = r.slice(found.cellStartCol, found.cellStartCol + found.detectedCellCount);
      return fixedBase.concat([fyLabel]).concat(cells);
    });

    var header = ['Date', 'County Name', 'County Code', 'SFY', 'FFY', 'Report Month', 'Source Fiscal Year']
      .concat(useLabels.map(function (lbl, idx) { return 'C' + (idx + 1) + ': ' + lbl; }));

    upsertFiscalYearRows_(CONFIG.TABS[variant.targetTab], header, fyLabel, newRows);

    logInfo_(sourceName, 'Ingested FY ' + fyLabel + ' (' + newRows.length + ' rows, format: ' + variant.name + ') from ' + fileInfo.url);
  } finally {
    if (tempId) deleteTempFile_(tempId);
  }
}

// Replaces any existing rows tagged with this fiscal year, then appends the fresh set.
// This makes re-running against a since-revised file (CDSS does post county revisions)
// safe to do repeatedly without creating duplicates.
function upsertFiscalYearRows_(targetTabName, header, fyLabel, newRows) {
  var ss = getSpreadsheet_();
  var sheet = getOrCreateSheet_(ss, targetTabName);

  var existing = [];
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow >= 2 && lastCol >= 7) {
    var existingData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    var fyCol = 6; // 0-indexed position of "Source Fiscal Year" (7th column)
    existing = existingData.filter(function (r) { return r[fyCol] !== fyLabel; });
  }

  var combined = existing.concat(newRows);
  writeRowsReplacingTab_(sheet, header, combined);
}

function ingestCF296FiscalYear_(fileInfo) {
  ingestCFFiscalYearGeneric_(fileInfo, CF296_VARIANTS, { current: CF296_LABELS, legacy: CF296_LABELS_LEGACY }, 'CF296');
}

function ingestCF18FiscalYear_(fileInfo) {
  ingestCFFiscalYearGeneric_(fileInfo, CF18_VARIANTS, { current: CF18_LABELS }, 'CF18');
}
