// SourceDiscovery.gs
//
// *** This is the one file most likely to need a live fix. ***
// I built these regexes from a text/markdown rendering of the CDSS pages (my tools
// couldn't execute JS or show me the raw HTML DOM), not from the actual HTML source.
// CDSS's site runs on DNN (a CMS), and DNN templates sometimes wrap links in extra
// spans/divs that a naive regex won't expect. If discoverCF296Files_ / discoverCF18Files_
// come back empty on the first real run, view-source the listing page and adjust the
// regex below — the fallback logging will tell you clearly if this happens rather than
// failing silently.

function discoverDashboardFile_() {
  var html = fetchText_(CONFIG.DASHBOARD_PAGE_URL);

  // Look for an <a href="....xlsx"> near the words "Raw Data"
  var linkMatch = html.match(/<a[^>]+href="([^"]+\.xlsx)"[^>]*>[^<]*Raw Data[^<]*<\/a>/i);
  var url = linkMatch ? linkMatch[1] : null;

  if (!url) {
    // Fallback: any .xlsx link containing "Master" in the path.
    var anyMatch = html.match(/<a[^>]+href="([^"]+Master[^"]*\.xlsx)"/i);
    url = anyMatch ? anyMatch[1] : null;
  }

  if (!url) {
    logWarn_('discoverDashboardFile_', 'Could not parse the Raw Data Excel link off the dashboard page; using the hardcoded fallback URL. Check SourceDiscovery.gs against the live page HTML.');
    url = CONFIG.DASHBOARD_XLSX_FALLBACK_URL;
  } else {
    url = normalizeUrl_(url);
  }

  var updatedMatch = html.match(/Updated:\s*([\d/]+)/i);
  var updatedText = updatedMatch ? updatedMatch[1] : '';

  return { url: url, updatedText: updatedText };
}

// Generic listing-page parser shared by CF296 and CF18: both pages render a table of
// "Fiscal Year YYYY-YY" links next to an "Updated MM/DD/YY" date.
function discoverFiscalYearFiles_(listingUrl, sourceName) {
  var html = fetchText_(listingUrl);
  var results = [];

  // Primary pattern: anchor text contains "Fiscal Year YYYY-YY", href is an .xlsx,
  // followed reasonably soon by a table cell with a date.
  var re = /<a[^>]+href="([^"]+\.xlsx)"[^>]*>\s*Fiscal Year\s+(\d{4}-\d{2,4})\s*<\/a>[\s\S]{0,300}?(\d{1,2}\/\d{1,2}\/\d{2,4})/gi;
  var m;
  while ((m = re.exec(html)) !== null) {
    results.push({
      fiscalYear: m[2],
      url: normalizeUrl_(m[1]),
      updatedText: m[3]
    });
  }

  if (results.length === 0) {
    // Fallback: grab every .xlsx link that looks like it belongs to this report
    // (CF296.../CF18... in the path), without requiring the "Fiscal Year" label text
    // or a nearby date. Less precise, but keeps the pipeline from doing nothing.
    logWarn_(sourceName, 'Primary listing-page regex found nothing; falling back to a looser xlsx-link scan. This page\'s HTML likely needs SourceDiscovery.gs updated — check view-source on ' + listingUrl);
    var looseRe = /<a[^>]+href="([^"]+\.xlsx)"/gi;
    while ((m = looseRe.exec(html)) !== null) {
      results.push({ fiscalYear: null, url: normalizeUrl_(m[1]), updatedText: '' });
    }
  }

  if (results.length === 0) {
    logError_(sourceName, 'Found zero file links at all on ' + listingUrl + '. This source will be skipped this run.');
  }

  return results;
}

function normalizeUrl_(url) {
  url = url.replace(/&amp;/g, '&');
  // CDSS's own HTML leaves literal spaces in some filenames unencoded (confirmed on a
  // live run 2026-07-16 — e.g. ".../Master data PUBLIC ACCESSIBLE.xlsx" and
  // ".../CF296 FY 2025-26.xlsx" came through with raw spaces, no %20). UrlFetchApp
  // is unreliable with raw spaces in a URL, so encode just the space character —
  // deliberately not a blanket encodeURI()/encodeURIComponent() here, since some of
  // these URLs may already be validly encoded elsewhere and double-encoding a "%" would
  // break them.
  // A plain ASCII-space regex (/ /g) turned out not to catch this on the live site as
  // of 2026-07-16 — CDSS's link text appears to use a non-breaking space (U+00A0) or
  // similar rather than a normal space, which looks identical in logs but isn't matched
  // by \x20. This broader whitespace class catches both, and collapses any run of them
  // into a single %20.
  url = url.replace(/\s+/g, '%20');
  if (url.indexOf('http') !== 0) {
    url = 'https://www.cdss.ca.gov' + url;
  }
  return url;
}

function discoverCF296Files_() {
  return discoverFiscalYearFiles_(CONFIG.CF296_LISTING_URL, 'CF296');
}

function discoverCF18Files_() {
  return discoverFiscalYearFiles_(CONFIG.CF18_LISTING_URL, 'CF18');
}
