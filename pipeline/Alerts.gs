// Alerts.gs
// Emails CONFIG.ALERT_EMAIL when the weekly pipeline run has a problem. Added 2026-10-23.
//
// Why this exists: Google's own "failure notification" email only fires when a run
// crashes outright. Most real problems here don't crash anything. PIPELINE_MAIN catches
// a failed download, writes it to Pipeline_Log as an ERROR, and finishes "successfully".
// And if CDSS redesigns a page so the "Updated" date can't be found, change detection
// compares blank to blank every week and quietly does nothing. This file covers both:
//
//   1. After every completed run, it reads the Pipeline_Log rows from that run and
//      emails you if any are ERROR, or if there's a WARN you haven't been told about yet
//      (repeat warnings are only emailed once, so a known quirk doesn't nag weekly).
//   2. It checks how long it's been since the master dashboard file was last
//      successfully ingested, and emails you every week that it's been longer than
//      CONFIG.STALE_AFTER_DAYS. This is the check that catches "ran fine, did nothing."
//   3. If the run crashes outright, PIPELINE_MAIN calls alertOnCrash_() before re-throwing,
//      so you hear about it right away (Google's own digest email still comes too).
//
// No email is sent when everything is fine.
//
// Manual entry point: testAlerts() sends a test email and logs the current staleness
// numbers. Run it once after pasting this file in, which also triggers the one-time
// consent prompt for the new "send email as you" permission.

function startRunHealthWindow_() {
  PropertiesService.getScriptProperties().setProperty('runStartedAt', String(Date.now()));
}

// Called by processJob_ after a successful master-file ingest.
function recordMasterIngest_() {
  PropertiesService.getScriptProperties().setProperty('lastMasterIngestAt', String(Date.now()));
}

function checkRunHealth_() {
  var props = PropertiesService.getScriptProperties();
  var since = Number(props.getProperty('runStartedAt')) || (Date.now() - 7 * 24 * 3600 * 1000);
  var entries = readLogEntriesSince_(since);

  var errors = entries.filter(function (e) { return e.level === 'ERROR'; });
  var warns = entries.filter(function (e) { return e.level === 'WARN'; });

  // Only email warnings we haven't already emailed about. The stored list is replaced
  // with this run's warnings, so a warning that goes away and later comes back gets
  // reported again.
  var alreadySent = JSON.parse(props.getProperty('alertedWarningKeys') || '[]');
  var thisRunKeys = [];
  var newWarns = warns.filter(function (w) {
    var key = warningKey_(w);
    if (thisRunKeys.indexOf(key) === -1) thisRunKeys.push(key);
    return alreadySent.indexOf(key) === -1;
  });
  props.setProperty('alertedWarningKeys', JSON.stringify(thisRunKeys.slice(-100)));

  var staleMessage = checkStaleness_();

  if (errors.length === 0 && newWarns.length === 0 && !staleMessage) {
    logInfo_('Alerts', 'Health check passed — no errors, no new warnings, data is current. No email sent.');
    return;
  }

  var subjectParts = [];
  if (errors.length) subjectParts.push(errors.length + ' error' + (errors.length === 1 ? '' : 's'));
  if (staleMessage) subjectParts.push('no new data lately');
  if (newWarns.length) subjectParts.push(newWarns.length + ' new warning' + (newWarns.length === 1 ? '' : 's'));
  var subject = 'CalFresh pipeline: ' + subjectParts.join(', ');

  var body = [];
  body.push('The weekly CalFresh data pipeline finished, but something needs a look.');
  body.push('');
  if (staleMessage) {
    body.push('== DATA MAY BE STALE ==');
    body.push(staleMessage);
    body.push('');
  }
  if (errors.length) {
    body.push('== ERRORS (' + errors.length + ') ==');
    errors.forEach(function (e) { body.push(formatLogEntry_(e)); });
    body.push('');
  }
  if (newWarns.length) {
    body.push('== NEW WARNINGS (' + newWarns.length + ') ==');
    body.push('(Warnings already emailed in an earlier week are not repeated.)');
    newWarns.forEach(function (e) { body.push(formatLogEntry_(e)); });
    body.push('');
  }
  body.push('Full log: the Pipeline_Log tab in ' + sheetUrl_());
  body.push('Run history: Extensions > Apps Script > Executions.');

  sendPipelineAlert_(subject, body.join('\n'));
}

// Returns a human-readable message if the master file hasn't been successfully
// ingested in too long, or null if it's fine.
function checkStaleness_() {
  var props = PropertiesService.getScriptProperties();
  var last = Number(props.getProperty('lastMasterIngestAt'));
  if (!last) {
    // First run after this file was added: we don't know the real last-ingest time,
    // so start the clock now rather than guessing.
    recordMasterIngest_();
    return null;
  }
  var days = Math.floor((Date.now() - last) / (24 * 3600 * 1000));
  if (days <= CONFIG.STALE_AFTER_DAYS) return null;

  return 'The master dashboard file has not been successfully downloaded in ' + days +
    ' days (alert threshold: ' + CONFIG.STALE_AFTER_DAYS + ' days; CDSS usually updates every 1–3 weeks).\n' +
    'Last "Updated" date the script saw on the CDSS page: "' +
    (props.getProperty('lastDashboardUpdatedText') || '(none)') + '".\n' +
    'Newest month currently in Master_Monthly: ' + newestMasterMonth_() + '.\n' +
    'Likely causes: CDSS changed its page so SourceDiscovery.gs no longer finds the date or link, ' +
    'or CDSS genuinely hasn\'t posted new data. Check ' + CONFIG.DASHBOARD_PAGE_URL;
}

function alertOnCrash_(e) {
  sendPipelineAlert_('CalFresh pipeline: run crashed',
    'The weekly CalFresh data pipeline stopped with an error before finishing:\n\n' +
    ((e && e.stack) || String(e)) + '\n\n' +
    'If this was a temporary Google or CDSS outage, the next weekly run will usually recover on its own.\n' +
    'Full log: the Pipeline_Log tab in ' + sheetUrl_() + '\n' +
    'Run history: Extensions > Apps Script > Executions.');
}

function sendPipelineAlert_(subject, body) {
  try {
    MailApp.sendEmail(CONFIG.ALERT_EMAIL, subject, body);
    logInfo_('Alerts', 'Sent alert email to ' + CONFIG.ALERT_EMAIL + ': ' + subject);
  } catch (err) {
    // Most likely cause: the send-email permission hasn't been approved yet.
    // Run testAlerts() from the editor to bring up the consent screen.
    logError_('Alerts', 'Could not send alert email (' + err + '). Subject was: ' + subject);
  }
}

// --- helpers ---

function readLogEntriesSince_(sinceMs) {
  var sh = getSpreadsheet_().getSheetByName(CONFIG.TABS.LOG);
  if (!sh || sh.getLastRow() < 2) return [];
  var lastRow = sh.getLastRow();
  var n = Math.min(lastRow - 1, 1000); // the log only grows; a week's run is far smaller than this
  var rows = sh.getRange(lastRow - n + 1, 1, n, 4).getValues();
  return rows
    .filter(function (r) {
      var d = parseDateSafe_(r[0]);
      return d && d.getTime() >= sinceMs;
    })
    .map(function (r) {
      return { when: parseDateSafe_(r[0]), level: String(r[1]), source: String(r[2]), message: String(r[3]) };
    });
}

// Digits are masked so "attempt 1/3" and "attempt 2/3", or "12 of 117 columns" vs
// "13 of 117", count as the same warning. Hashed to keep the stored property small.
function warningKey_(entry) {
  var text = entry.source + '|' + entry.message.replace(/\d+/g, '#');
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, text);
  return Utilities.base64Encode(bytes);
}

function formatLogEntry_(e) {
  var when = Utilities.formatDate(e.when, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  return '- [' + when + '] ' + e.source + ': ' + e.message;
}

function newestMasterMonth_() {
  try {
    var sh = getSpreadsheet_().getSheetByName(CONFIG.TABS.MASTER_MONTHLY);
    if (!sh || sh.getLastRow() < 2) return '(tab is empty)';
    var dateCol = 7; // 'Date' is the 7th column, same as RETENTION_TARGETS in Retention.gs
    var values = sh.getRange(2, dateCol, sh.getLastRow() - 1, 1).getValues();
    var newest = null;
    values.forEach(function (r) {
      var d = parseDateSafe_(r[0]);
      if (d && (!newest || d > newest)) newest = d;
    });
    return newest ? Utilities.formatDate(newest, Session.getScriptTimeZone(), 'MMMM yyyy') : '(no readable dates)';
  } catch (e) {
    return '(could not read: ' + e + ')';
  }
}

function sheetUrl_() {
  return 'https://docs.google.com/spreadsheets/d/' + CONFIG.SHEET_ID + '/edit';
}

// Run this by hand once after adding this file. It sends a test email (which brings up
// the one-time consent prompt for sending mail) and logs the staleness numbers so you
// can see what the check is working from.
function testAlerts() {
  var props = PropertiesService.getScriptProperties();
  var last = Number(props.getProperty('lastMasterIngestAt'));
  Logger.log('Alert email goes to: ' + CONFIG.ALERT_EMAIL);
  Logger.log('Stale-data threshold: ' + CONFIG.STALE_AFTER_DAYS + ' days');
  Logger.log('Last successful master ingest recorded: ' +
    (last ? new Date(last) : 'none yet (clock starts on the next weekly run)'));
  Logger.log('Last CDSS "Updated" text seen: ' + (props.getProperty('lastDashboardUpdatedText') || '(none)'));
  Logger.log('Newest month in Master_Monthly: ' + newestMasterMonth_());
  MailApp.sendEmail(CONFIG.ALERT_EMAIL, 'CalFresh pipeline: test alert',
    'This is a test from the CalFresh pipeline\'s new alert check. If you got this, alerts are working.\n\n' +
    'You will only get emails from here on when a weekly run has errors, a new warning, ' +
    'or no new data from CDSS in more than ' + CONFIG.STALE_AFTER_DAYS + ' days.\n\n' + sheetUrl_());
  Logger.log('Test email sent. Check your inbox.');
}
