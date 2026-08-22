// WebApi.gs
// UNUSED (2026-08-22). Written as a public JSON feed when spreadsheet-ID gviz URLs
// returned 401. The dashboard now reads the Publish-to-web 2PACX CSV instead
// (see PUBLISHED_SHEET in data.js). Keep this file in the repo as a fallback if
// that published CSV ever stops being anonymously readable. Do not deploy unless
// that happens.

//
// doGet() only reads the slim computed tabs from Participation.gs — it does NOT
// scan Master_Monthly on each page load. That's what keeps this fast enough for
// a public site: the heavy extract already ran during the weekly pipeline.
//
// Setup: see pipeline/SETUP.md, "Publishing the dashboard feed." After you
// deploy, paste the web-app URL into SHEET_FEED_URL in index.html.

function doGet(e) {
  var payload;
  try {
    payload = buildParticipationFeed_();
  } catch (err) {
    payload = { error: String(err) };
  }

  var json = JSON.stringify(payload);
  var callback = e && e.parameter && e.parameter.callback;
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function buildParticipationFeed_() {
  var ss = getSpreadsheet_();
  var monthlySheet = ss.getSheetByName(PARTICIPATION_COMPUTED_TAB);
  if (!monthlySheet || monthlySheet.getLastRow() < 2) {
    throw new Error(
      'No data on "' + PARTICIPATION_COMPUTED_TAB +
      '". Run testParticipation() in the Apps Script editor first (see pipeline/SETUP.md).'
    );
  }

  var monthlyValues = monthlySheet.getDataRange().getValues();
  var monthly = {
    columns: ['county', 'period', 'persons', 'households', 'child_only',
              'dual_medi_cal', 'dollars_issued', 'students'],
    rows: monthlyValues.slice(1).map(function (row) {
      // Participation_Computed column order: County, Period, Month, Calendar Year,
      // Persons, Households, Child-only, Dual Medi-Cal, Dollars, Students.
      return [
        row[0],
        row[1],
        feedNumber_(row[4]),
        feedNumber_(row[5]),
        feedNumber_(row[6]),
        feedNumber_(row[7]),
        feedNumber_(row[8]),
        feedNumber_(row[9])
      ];
    })
  };

  var ageSheet = ss.getSheetByName(AGE_BANDS_COMPUTED_TAB);
  var ageBands = { columns: ['county', 'period', 'elderly', 'a1859', 'children'], rows: [] };
  if (ageSheet && ageSheet.getLastRow() >= 2) {
    ageBands.rows = ageSheet.getDataRange().getValues().slice(1).map(function (row) {
      return [
        row[0],
        row[1],
        feedNumber_(row[2]),
        feedNumber_(row[3]),
        feedNumber_(row[4])
      ];
    });
  }

  return {
    generated_at: PropertiesService.getScriptProperties().getProperty('participationGeneratedAt') || null,
    monthly: monthly,
    age_bands: ageBands
  };
}

function feedNumber_(v) {
  if (v === '' || v === null || v === undefined || v === '*') return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  var n = Number(String(v).replace(/,/g, '').trim());
  return isNaN(n) ? null : n;
}

function testParticipationFeed() {
  var payload = buildParticipationFeed_();
  Logger.log('monthly rows: ' + payload.monthly.rows.length);
  Logger.log('age-band rows: ' + payload.age_bands.rows.length);
  Logger.log('generated_at: ' + payload.generated_at);
  Logger.log('sample monthly row: ' + JSON.stringify(payload.monthly.rows[0]));
}
