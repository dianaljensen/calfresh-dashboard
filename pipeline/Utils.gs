// Utils.gs
// Shared helpers: logging, HTTP fetch, time-budget tracking, xlsx-to-Sheet conversion,
// and the continuation-trigger mechanism that lets a multi-hour backfill survive
// Apps Script's 6-minute-per-execution cap.

// Uses getActiveSpreadsheet() rather than openById(CONFIG.SHEET_ID) on purpose: this is
// a container-bound script (created via Extensions > Apps Script from inside the Sheet
// itself), and getActiveSpreadsheet() resolves to that bound container correctly even
// from a time-driven trigger with no user present. That's what lets us request the much
// narrower 'spreadsheets.currentonly' OAuth scope instead of full access to every Sheet
// in the account — openById() on an arbitrary ID (even our own) doesn't reliably qualify
// as "current" under that restricted scope, but the bound container always does.
function getSpreadsheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getId() !== CONFIG.SHEET_ID) {
    logWarn_('Config', 'This script is bound to spreadsheet ' + ss.getId() +
      ' but CONFIG.SHEET_ID is set to ' + CONFIG.SHEET_ID + ' — update Config.gs.');
  }
  return ss;
}

function getOrCreateSheet_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function logToPipeline_(level, source, message) {
  try {
    var ss = getSpreadsheet_();
    var sh = getOrCreateSheet_(ss, CONFIG.TABS.LOG);
    if (sh.getLastRow() === 0) {
      sh.appendRow(['Timestamp', 'Level', 'Source', 'Message']);
    }
    sh.appendRow([new Date(), level, source, message]);
  } catch (e) {
    // Logging should never be the thing that breaks the pipeline.
    Logger.log('logToPipeline_ failed: ' + e);
  }
}

function logInfo_(source, message) { logToPipeline_('INFO', source, message); }
function logWarn_(source, message) { logToPipeline_('WARN', source, message); }
function logError_(source, message) { logToPipeline_('ERROR', source, message); }

// --- Time budget ---
// Call startClock_() once at the top of the main entry point, then check
// isTimeUp_() before starting each significant unit of work (one source file,
// one fiscal year, etc). If it's time, stop cleanly and schedule a continuation.
function startClock_() {
  return Date.now();
}

function isTimeUp_(startedAt) {
  return (Date.now() - startedAt) > CONFIG.TIME_BUDGET_MS;
}

// Recognizes the class of "Google's own infrastructure briefly hiccuped" error rather
// than a real bug — 502/503 responses, and Apps Script's generic "Service X failed
// while accessing document" wrapper, both observed during the 2026-07-16 backfill and
// both resolved on a plain retry. Deliberately not everything: a genuine 4xx like a
// missing tab or a malformed range should still fail loudly rather than retry 3 times
// and waste a few minutes before reporting the same real problem.
function isTransientError_(e) {
  var msg = String(e);
  return /50[023]|Service \w+ failed|timed out|rate limit/i.test(msg);
}

function scheduleContinuation_(functionName) {
  // Remove any existing one-off continuation triggers for this function first,
  // so repeated early-exits don't stack up duplicate triggers.
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === functionName + '_continuation') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger(functionName + '_continuation')
    .timeBased()
    .after(CONFIG.CONTINUATION_DELAY_MINUTES * 60 * 1000)
    .create();
}

function clearContinuationTriggers_(functionName) {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === functionName + '_continuation') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

// --- HTTP ---
function fetchText_(url) {
  var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  if (resp.getResponseCode() >= 400) {
    throw new Error('Fetch failed (' + resp.getResponseCode() + ') for ' + url);
  }
  return resp.getContentText();
}

function fetchBlob_(url) {
  var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  if (resp.getResponseCode() >= 400) {
    throw new Error('Fetch failed (' + resp.getResponseCode() + ') for ' + url);
  }
  return resp.getBlob();
}

// HEAD-style check: many servers answer a GET with the same Last-Modified/Content-Length
// headers we'd get from a HEAD request, and UrlFetchApp doesn't reliably support HEAD
// against IIS servers like CDSS's, so we fetch the file and read headers rather than
// downloading twice.
function getUrlFingerprint_(url) {
  var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  var headers = resp.getAllHeaders();
  var lastModified = headers['Last-Modified'] || headers['last-modified'] || '';
  var contentLength = headers['Content-Length'] || headers['content-length'] || '';
  return { lastModified: lastModified, contentLength: contentLength, blob: resp.getBlob() };
}

// --- xlsx -> native Google Sheet conversion ---
// Requires the "Drive API" Advanced Google Service (v3) to be enabled in this
// Apps Script project (Services > + > Google Drive API). See README setup steps.
function convertXlsxBlobToTempSpreadsheet_(blob, title) {
  var resource = {
    name: title,
    mimeType: MimeType.GOOGLE_SHEETS,
    parents: [CONFIG.FOLDER_ID]
  };
  var file = Drive.Files.create(resource, blob, { fields: 'id' });
  return file.id;
}

function deleteTempFile_(fileId) {
  try {
    Drive.Files.remove(fileId);
  } catch (e) {
    Logger.log('Could not delete temp file ' + fileId + ': ' + e);
  }
}

// Reads an entire tab out of another spreadsheet (the temp converted files) using the
// read-only Advanced Sheets Service, rather than SpreadsheetApp.openById(). This is what
// lets us request 'spreadsheets.readonly' for this path instead of full edit/delete
// access to every Sheet in the account — SpreadsheetApp.openById() on a file that isn't
// this script's own bound container doesn't work under a restricted scope, but the
// Sheets API's readonly scope is built exactly for "read some other file by ID".
// Requires the "Google Sheets API" advanced service enabled (see SETUP.md).
//
// Note: the Sheets API trims trailing empty cells per row, so rows can come back
// different lengths (unlike SpreadsheetApp's getValues(), which is always rectangular).
// We pad every row out to the widest row found so downstream code can keep indexing
// by column number without special-casing short rows.
// Lists the tab names in another spreadsheet (the temp converted files), so ingest
// code can check which known layout variant it's dealing with before trying to read
// a specific tab by name. Also read-only, also covered by 'spreadsheets.readonly'.
function listSheetTabs_(spreadsheetId) {
  var meta = Sheets.Spreadsheets.get(spreadsheetId, { fields: 'sheets.properties.title' });
  return meta.sheets.map(function (s) { return s.properties.title; });
}

function fetchSheetValues_(spreadsheetId, tabName) {
  var resp = Sheets.Spreadsheets.Values.get(spreadsheetId, "'" + tabName + "'");
  var values = resp.values || [];
  var maxLen = 0;
  values.forEach(function (r) { if (r.length > maxLen) maxLen = r.length; });
  return values.map(function (r) {
    var padded = r.slice();
    while (padded.length < maxLen) padded.push('');
    return padded;
  });
}

// --- Misc ---
function assertLabelCountMatches_(source, expected, actual) {
  if (expected !== actual) {
    logWarn_(source,
      'Expected ' + expected + ' "Cell N" columns but found ' + actual +
      '. CDSS may have changed this report\'s layout. Falling back to generic ' +
      '"Cell N" headers for this ingest so nothing silently mis-labels; the ' +
      'label dictionary in Labels.gs needs a human to review and update.');
    return false;
  }
  return true;
}

function parseDateSafe_(v) {
  if (v instanceof Date) return v;
  if (!v) return null;
  var d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function yearsAgo_(n) {
  var d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d;
}

// Cheap proxy for "cells in use" per tab: last row * last column of the used range.
// Not exact (doesn't account for gaps), but the same metric consistently applied,
// which is what matters for a threshold check.
function computeTotalCellCount_(ss) {
  var total = 0;
  ss.getSheets().forEach(function (sh) {
    total += sh.getLastRow() * sh.getLastColumn();
  });
  return total;
}

function writeRowsReplacingTab_(sheet, headerRow, dataRows2D) {
  sheet.clearContents();
  if (headerRow && headerRow.length) {
    sheet.getRange(1, 1, 1, headerRow.length).setValues([headerRow]);
  }
  if (dataRows2D.length) {
    var startRow = headerRow ? 2 : 1;
    sheet.getRange(startRow, 1, dataRows2D.length, dataRows2D[0].length).setValues(dataRows2D);
  }
}
