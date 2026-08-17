// Main.gs
// Entry points. These are the only functions you should ever need to run manually
// from the Apps Script editor's function picker:
//
//   testDiscovery()       — read-only sanity check, run this FIRST. Logs what the
//                           script found on the three CDSS pages without writing
//                           anything. See Executions / Logger output.
//   runInitialBackfill()  — one-time historical backfill. Kicks off automatically-
//                           continuing runs until every available fiscal year and
//                           the master file are loaded. Safe to re-run any time
//                           (it upserts, doesn't duplicate).
//   installWeeklyTrigger()— run once, after backfill looks good, to make PIPELINE_MAIN
//                           run automatically every week from here on.
//   PIPELINE_MAIN()       — the recurring job itself. You generally don't need to
//                           run this by hand; the weekly trigger does it.

function testDiscovery() {
  Logger.log('--- Dashboard master ---');
  Logger.log(JSON.stringify(discoverDashboardFile_(), null, 2));
  Logger.log('--- CF296 fiscal years found ---');
  Logger.log(JSON.stringify(discoverCF296Files_(), null, 2));
  Logger.log('--- CF18 fiscal years found ---');
  Logger.log(JSON.stringify(discoverCF18Files_(), null, 2));
  Logger.log('If any of the above came back empty, or fiscalYear/updatedText are null, ' +
    'the regex in SourceDiscovery.gs needs adjusting against that page\'s real HTML — ' +
    'see the comment at the top of that file.');
}

function buildChangeQueue_() {
  var props = PropertiesService.getScriptProperties();
  var queue = [];

  var dashInfo = discoverDashboardFile_();
  var lastDash = props.getProperty('lastDashboardUpdatedText');
  if (dashInfo.updatedText !== lastDash) {
    queue.push({ type: 'dashboard', url: dashInfo.url, updatedText: dashInfo.updatedText });
  } else {
    logInfo_('Master', 'No change since last check (still "' + dashInfo.updatedText + '") — skipping.');
  }

  var lastCF296 = JSON.parse(props.getProperty('lastCF296Fingerprints') || '{}');
  discoverCF296Files_().forEach(function (f) {
    var key = f.fiscalYear || f.url;
    if (lastCF296[key] !== f.updatedText) {
      queue.push({ type: 'cf296', fiscalYear: f.fiscalYear, url: f.url, updatedText: f.updatedText });
    }
  });

  var lastCF18 = JSON.parse(props.getProperty('lastCF18Fingerprints') || '{}');
  discoverCF18Files_().forEach(function (f) {
    var key = f.fiscalYear || f.url;
    if (lastCF18[key] !== f.updatedText) {
      queue.push({ type: 'cf18', fiscalYear: f.fiscalYear, url: f.url, updatedText: f.updatedText });
    }
  });

  return queue;
}

function processJob_(job) {
  var props = PropertiesService.getScriptProperties();

  if (job.type === 'dashboard') {
    ingestDashboardMaster_({ url: job.url, updatedText: job.updatedText });
    props.setProperty('lastDashboardUpdatedText', job.updatedText);

  } else if (job.type === 'cf296') {
    ingestCF296FiscalYear_({ fiscalYear: job.fiscalYear, url: job.url });
    var m296 = JSON.parse(props.getProperty('lastCF296Fingerprints') || '{}');
    m296[job.fiscalYear || job.url] = job.updatedText;
    props.setProperty('lastCF296Fingerprints', JSON.stringify(m296));

  } else if (job.type === 'cf18') {
    ingestCF18FiscalYear_({ fiscalYear: job.fiscalYear, url: job.url });
    var m18 = JSON.parse(props.getProperty('lastCF18Fingerprints') || '{}');
    m18[job.fiscalYear || job.url] = job.updatedText;
    props.setProperty('lastCF18Fingerprints', JSON.stringify(m18));
  }
}

function PIPELINE_MAIN() {
  var startedAt = startClock_();
  var props = PropertiesService.getScriptProperties();
  var queueJson = props.getProperty('pendingQueue');
  var queue;

  if (queueJson) {
    queue = JSON.parse(queueJson);
    logInfo_('Main', 'Resuming previous run — ' + queue.length + ' job(s) left in the queue.');
  } else {
    queue = buildChangeQueue_();
    logInfo_('Main', 'Starting new run — ' + queue.length + ' source(s) changed since last check.');
  }

  while (queue.length > 0) {
    if (isTimeUp_(startedAt)) {
      props.setProperty('pendingQueue', JSON.stringify(queue));
      scheduleContinuation_('PIPELINE_MAIN');
      logInfo_('Main', 'Time budget reached with ' + queue.length + ' job(s) remaining — continuation run scheduled in ' + CONFIG.CONTINUATION_DELAY_MINUTES + ' minute(s).');
      return;
    }
    var job = queue.shift();
    try {
      processJob_(job);
    } catch (e) {
      var attempts = (job.attempts || 0) + 1;
      if (attempts < CONFIG.MAX_JOB_ATTEMPTS && isTransientError_(e)) {
        job.attempts = attempts;
        queue.push(job); // retry later, after whatever's left in this run
        logWarn_('Main', 'Job hit a likely-transient error (attempt ' + attempts + '/' +
          CONFIG.MAX_JOB_ATTEMPTS + ', will retry): ' + JSON.stringify(job) + ' — ' + e);
      } else {
        logError_('Main', 'Job failed permanently (' + JSON.stringify(job) + '): ' + e);
      }
    }
  }

  props.deleteProperty('pendingQueue');
  clearContinuationTriggers_('PIPELINE_MAIN');
  enforceRetention_();
  // Recomputes the SSI-linked participant categories (SSILinked.gs) from whatever's
  // currently in Master_Monthly. Runs every time the queue drains, even on weeks where
  // nothing changed upstream -- it's a cheap columnar pass over a few thousand rows, and
  // keeping it unconditional means the computed tab never silently drifts out of sync
  // with a change-detection bug elsewhere. This is what keeps the SSI-linked chart
  // category self-refreshing with no manual export step (see TODO.md).
  computeSSILinked_();
  // Same self-refreshing treatment for the "students on CalFresh" chart category --
  // see CaseloadStudents.gs for why "Caseload Total Student Count" is trustworthy here.
  computeCaseloadStudents_();
  logInfo_('Main', 'Run complete — all queued sources processed, retention enforced.');
}

// This is the function name the continuation trigger actually calls
// (see scheduleContinuation_ in Utils.gs). It just re-enters the same logic.
function PIPELINE_MAIN_continuation() {
  PIPELINE_MAIN();
}

function runInitialBackfill() {
  var queue = [];

  var dashInfo = discoverDashboardFile_();
  queue.push({ type: 'dashboard', url: dashInfo.url, updatedText: dashInfo.updatedText });

  discoverCF296Files_().forEach(function (f) {
    queue.push({ type: 'cf296', fiscalYear: f.fiscalYear, url: f.url, updatedText: f.updatedText });
  });
  discoverCF18Files_().forEach(function (f) {
    queue.push({ type: 'cf18', fiscalYear: f.fiscalYear, url: f.url, updatedText: f.updatedText });
  });

  PropertiesService.getScriptProperties().setProperty('pendingQueue', JSON.stringify(queue));
  logInfo_('Backfill', 'Queued ' + queue.length + ' file(s) for full historical backfill.' +
    ' This will very likely need several continuation runs to finish (6-minute execution cap)' +
    ' — it will keep going on its own every ' + CONFIG.CONTINUATION_DELAY_MINUTES +
    ' minutes without you doing anything further. Watch the Pipeline_Log tab for progress.');
  PIPELINE_MAIN();
}

function installWeeklyTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (t) {
    if (t.getHandlerFunction() === 'PIPELINE_MAIN' && t.getEventType() === ScriptApp.EventType.CLOCK) {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('PIPELINE_MAIN')
    .timeBased()
    .everyWeeks(1)
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(3)
    .create();
  logInfo_('Setup', 'Installed weekly trigger: PIPELINE_MAIN runs Mondays around 3am.');
}
