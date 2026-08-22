// Live spreadsheet feed for the participation view.
// Fetches the Publish-to-web CSV for specific tabs of "CalFresh Data - Consolidated".
// That 2PACX URL is public; spreadsheet-ID gviz URLs are not (they 401 unless signed in).

const PUBLISHED_SHEET = {
  base: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTFzUHnRs-aXlIQhySWVRbTPZtSkM3--uskf8F3dCxnsEXRoIWePnuL8KoigtOP6W-hh22xLDNfivRK',
  monthlyGid: '447670588',      // Master_Monthly
  annualGid: '1345412068',       // Master_Annual
  pointInTimeGid: '1435977340'   // Master_PointInTime (dual Medi-Cal enrollment)
};

const MONTH_NUMBERS = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12'
};

const OVERLAY_META = {
  child_only: {
    label: 'People in Child-Only Households',
    description: 'Persons in child-only CalFresh cases (no eligible adult in the household).',
    cadence: 'monthly',
    color: '#8a3b6c'
  },
  dual_medi_cal: {
    label: 'Also enrolled in Medi-Cal',
    description: 'CalFresh persons also enrolled in Medi-Cal. Reported quarterly (Jan/Apr/Jul/Oct), not monthly — plotted as a step function, holding flat between readings.',
    cadence: 'quarterly',
    color: '#6c8a3b'
  },
  students: {
    label: 'Students',
    description: "Persons in CalFresh cases counted in Master_Monthly's 'Caseload Total Student Count' column (a caseload characteristic, not a separate program). Reported monthly from Jan 2023 onward, with no data before that.",
    cadence: 'monthly',
    color: '#b03a3a'
  },
  dollars_issued: {
    label: 'CalFresh Benefits Issued',
    description: "Master_Monthly's 'Total Issuances' column (dollar value of CalFresh benefits issued that month). Statewide figures go back to 2014; county-level breakdowns only exist from Sep 2023 onward — shown as a gap before that for any county other than California.",
    cadence: 'monthly',
    color: '#2a6ebb',
    axis: 'y1'
  }
};

const AGE_BANDS_META = {
  label: 'By age group',
  description: "60+ / Age 18–59 / Children (under 18), from CDSS's Annual tab — the real caseload age breakdown (a different, correctly-labeled source than the “Caseload Age” columns, which are students-only).",
  cadence: 'annual',
  caveat: "CDSS reports this once a year, as a July snapshot — shown here as a step (each year's reading holds flat through the following months until the next July reading). Age bands: 60+ = 60 and older, Children = under 18."
};

// CDSS reporting holes treated as missing rather than real cliffs. Applied here
// on every live refresh so they don't disappear the way they would if they
// lived only in a static snapshot (see TODO.md, Feb 2019 data gap).
const PERSONS_GAPS = {
  ALL: ['2019-02'],
  Sonoma: ['2019-04']
};

let DATA;

function publishedCsvUrl(gid) {
  return PUBLISHED_SHEET.base + '/pub?gid=' + gid + '&single=true&output=csv';
}

function normalizeHeader(s) {
  return String(s == null ? '' : s)
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .trim()
    .toLowerCase();
}

function headerMap(fields) {
  const map = {};
  (fields || []).forEach(f => { map[normalizeHeader(f)] = f; });
  return map;
}

function findCol(map, aliases) {
  for (let i = 0; i < aliases.length; i++) {
    const hit = map[normalizeHeader(aliases[i])];
    if (hit) return hit;
  }
  return null;
}

function parseNumber(v) {
  if (v === '' || v == null || v === '*') return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  const n = Number(String(v).replace(/,/g, '').replace(/%/g, '').trim());
  return isNaN(n) ? null : n;
}

function buildPeriod(monthName, year) {
  const monthNum = MONTH_NUMBERS[String(monthName == null ? '' : monthName).trim().toLowerCase()];
  const yearNum = parseNumber(year);
  if (!monthNum || !yearNum) return null;
  return yearNum + '-' + monthNum;
}

function normalizeCountyName(name) {
  const s = String(name == null ? '' : name).trim();
  if (!s) return '';
  const key = s.toLowerCase();
  if (key === 'statewide' || key === 'california' || key === 'ca' ||
      key === 'state' || key === 'state total' || key === 'california (statewide)' ||
      key === 'california statewide') {
    return 'Statewide';
  }
  return s;
}

function parseCsv(text, label) {
  if (typeof Papa === 'undefined') {
    throw new Error('CSV parser (PapaParse) did not load.');
  }
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  if (!parsed.data || !parsed.data.length) {
    throw new Error('No rows in ' + label + '.');
  }
  return parsed;
}

async function fetchCsv(gid, label) {
  const res = await fetch(publishedCsvUrl(gid), { redirect: 'follow' });
  if (!res.ok) throw new Error(label + ' returned HTTP ' + res.status);
  const text = await res.text();
  if (/^\s*<!DOCTYPE html/i.test(text) || text.indexOf('show-login') !== -1) {
    throw new Error(label + ' came back as a login page, not CSV. Check Publish to web is still on.');
  }
  return parseCsv(text, label);
}

function csvToMonthlyRows(parsed) {
  const map = headerMap(parsed.meta.fields);
  const countyCol = findCol(map, ['County']);
  const monthCol = findCol(map, ['Month']);
  const yearCol = findCol(map, ['Calendar Year']);
  const personsCol = findCol(map, ['CalFresh Persons']);
  if (!countyCol || !monthCol || !yearCol || !personsCol) {
    throw new Error('Master_Monthly is missing County / Month / Calendar Year / CalFresh Persons.');
  }
  const cols = {
    households: findCol(map, ['CalFresh Households']),
    child_only: findCol(map, ['Child Only Persons', 'Persons in Child-Only Households']),
    dollars_issued: findCol(map, ['Total Issuances']),
    students: findCol(map, ['Caseload Total Student Count'])
  };
  return parsed.data.map(row => {
    const county = normalizeCountyName(row[countyCol]);
    const period = buildPeriod(row[monthCol], row[yearCol]);
    if (!county || !period) return null;
    const rec = {
      county: county,
      period: period,
      persons: parseNumber(row[personsCol]),
      households: parseNumber(row[cols.households]),
      child_only: parseNumber(row[cols.child_only]),
      dual_medi_cal: null,
      dollars_issued: parseNumber(row[cols.dollars_issued]),
      students: parseNumber(row[cols.students])
    };
    if (rec.persons == null && rec.households == null && rec.child_only == null &&
        rec.dollars_issued == null && rec.students == null) {
      return null; // CDSS placeholder rows for months not yet reported
    }
    return rec;
  }).filter(Boolean);
}

function csvToDualRows(parsed) {
  const map = headerMap(parsed.meta.fields);
  const countyCol = findCol(map, ['County']);
  const monthCol = findCol(map, ['Month']);
  const yearCol = findCol(map, ['Calendar Year']);
  const dualCol = findCol(map, [
    'Dual Enrolled Persons in Medi-Cal and CalFresh',
    'CalFresh Persons Receiving Medi-Cal'
  ]);
  if (!countyCol || !monthCol || !yearCol || !dualCol) {
    throw new Error('Master_PointInTime is missing Dual Enrolled Persons in Medi-Cal and CalFresh.');
  }
  return parsed.data.map(row => {
    const county = normalizeCountyName(row[countyCol]);
    const period = buildPeriod(row[monthCol], row[yearCol]);
    if (!county || !period) return null;
    const dual = parseNumber(row[dualCol]);
    if (dual == null) return null;
    return { county: county, period: period, dual_medi_cal: dual };
  }).filter(Boolean);
}

function csvToAgeRows(parsed) {
  const map = headerMap(parsed.meta.fields);
  const countyCol = findCol(map, ['County']);
  const yearCol = findCol(map, ['Calendar Year', 'Year']);
  const elderlyCol = findCol(map, ['Elderly CalFresh July', 'Elderly CalFresh']);
  const a1859Col = findCol(map, ['Age 18 to 59 CalFresh July', 'Age 18 to 59 CalFresh']);
  const childrenCol = findCol(map, ['Children CalFresh July', 'Children CalFresh']);
  if (!countyCol || !yearCol) {
    throw new Error('Master_Annual is missing County / Calendar Year.');
  }
  return parsed.data.map(row => {
    const county = normalizeCountyName(row[countyCol]);
    const yearNum = parseNumber(row[yearCol]);
    if (!county || !yearNum) return null;
    return {
      county: county,
      period: yearNum + '-07',
      elderly: parseNumber(row[elderlyCol]),
      a1859: parseNumber(row[a1859Col]),
      children: parseNumber(row[childrenCol])
    };
  }).filter(Boolean);
}

function mergeDualIntoMonthly(monthly, dualRows) {
  const index = {};
  monthly.forEach(r => { index[r.county + '|' + r.period] = r; });
  dualRows.forEach(d => {
    const key = d.county + '|' + d.period;
    if (index[key]) {
      index[key].dual_medi_cal = d.dual_medi_cal;
    } else {
      monthly.push({
        county: d.county,
        period: d.period,
        persons: null,
        households: null,
        child_only: null,
        dual_medi_cal: d.dual_medi_cal,
        dollars_issued: null,
        students: null
      });
    }
  });
  return monthly;
}

function rowsToObjects(block) {
  if (!block || !block.columns || !block.rows) return [];
  return block.rows.map(row => {
    const obj = {};
    block.columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

function toColumnBlock(rows, columns) {
  return {
    columns: columns,
    rows: rows.map(r => columns.map(c => r[c]))
  };
}

function priorYearPeriod(period) {
  const parts = String(period || '').split('-');
  if (parts.length < 2) return null;
  return (parseInt(parts[0], 10) - 1) + '-' + parts[1];
}

function applyPersonsGaps(series) {
  Object.keys(series).forEach(county => {
    const extra = PERSONS_GAPS[county] || [];
    PERSONS_GAPS.ALL.concat(extra).forEach(month => {
      if (series[county].persons) series[county].persons[month] = null;
    });
  });
}

function yoyPct(current, prior) {
  if (current == null || prior == null || prior === 0) return null;
  return Math.round(((current - prior) / prior) * 100 * 1000) / 1000;
}

function lastNonNullMonth(seriesObj) {
  if (!seriesObj) return null;
  const months = Object.keys(seriesObj).filter(m => seriesObj[m] != null).sort();
  return months.length ? months[months.length - 1] : null;
}

function buildDashboardData(payload) {
  const monthly = rowsToObjects(payload.monthly);
  const ageRows = rowsToObjects(payload.age_bands);

  const series = {};
  const overlaySeries = {
    child_only: {},
    dual_medi_cal: {},
    students: {},
    dollars_issued: {}
  };
  const countiesSet = new Set();
  const monthsSet = new Set();

  function ensureSeries(county) {
    if (!series[county]) series[county] = { persons: {}, households: {}, yoy_pct: {} };
    return series[county];
  }
  function ensureOverlay(key, county) {
    if (!overlaySeries[key][county]) overlaySeries[key][county] = {};
    return overlaySeries[key][county];
  }

  monthly.forEach(r => {
    if (!r.county || !r.period) return;
    monthsSet.add(r.period);
    if (r.county !== 'Statewide') countiesSet.add(r.county);
    const s = ensureSeries(r.county);
    if (r.persons != null) s.persons[r.period] = r.persons;
    if (r.households != null) s.households[r.period] = r.households;
    if (r.child_only != null) ensureOverlay('child_only', r.county)[r.period] = r.child_only;
    if (r.dual_medi_cal != null) ensureOverlay('dual_medi_cal', r.county)[r.period] = r.dual_medi_cal;
    if (r.students != null) ensureOverlay('students', r.county)[r.period] = r.students;
    if (r.dollars_issued != null) ensureOverlay('dollars_issued', r.county)[r.period] = r.dollars_issued;
  });

  applyPersonsGaps(series);

  const months = Array.from(monthsSet).sort();
  const all_counties = Array.from(countiesSet).sort();
  const entities = ['Statewide'].concat(all_counties);

  entities.forEach(county => {
    const s = ensureSeries(county);
    months.forEach(m => {
      if (s.persons[m] === undefined) s.persons[m] = null;
      if (s.households[m] === undefined) s.households[m] = null;
      s.yoy_pct[m] = yoyPct(s.persons[m], s.persons[priorYearPeriod(m)]);
    });
  });

  let latest_complete_month = months[months.length - 1] || null;
  for (let i = months.length - 1; i >= 0; i--) {
    if (series.Statewide && series.Statewide.persons[months[i]] != null) {
      latest_complete_month = months[i];
      break;
    }
  }

  const ranked = all_counties
    .map(c => ({ c: c, h: series[c].households[latest_complete_month] || 0 }))
    .sort((a, b) => b.h - a.h);
  const xlarge = {};
  ranked.slice(0, 6).forEach(row => { xlarge[row.c] = true; });

  const county_meta = {};
  all_counties.forEach(c => {
    const h = series[c].households[latest_complete_month] || 0;
    let size = 'Small';
    if (xlarge[c]) size = 'X-Large';
    else if (h > 25000) size = 'Large';
    else if (h >= 5000) size = 'Medium';
    county_meta[c] = { households_latest: h, size: size };
  });

  const ageSeries = {};
  ageRows.forEach(r => {
    if (!r.county || !r.period) return;
    if (!ageSeries[r.county]) ageSeries[r.county] = {};
    ageSeries[r.county][r.period] = {
      elderly: r.elderly,
      a1859: r.a1859,
      children: r.children
    };
  });

  const childLast = lastNonNullMonth(overlaySeries.child_only.Statewide);
  const overlays = {};
  Object.keys(OVERLAY_META).forEach(key => {
    const meta = Object.assign({}, OVERLAY_META[key]);
    if (key === 'child_only' && childLast) {
      meta.description += ' Latest reading in the live file: ' + childLast + '.';
    }
    meta.series = overlaySeries[key];
    overlays[key] = meta;
  });

  return {
    months: months,
    latest_complete_month: latest_complete_month,
    series: series,
    county_meta: county_meta,
    all_counties: all_counties,
    demographic_layers: {
      overlays: overlays,
      age_bands: Object.assign({}, AGE_BANDS_META, { series: ageSeries })
    }
  };
}

function fmtMonthShort(period) {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) return period;
  const [y, m] = period.split('-');
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return names[parseInt(m, 10) - 1] + ' ' + y;
}

async function startLiveDashboard(initDashboard) {
  const statusEl = document.getElementById('dataStatus');
  const mainEl = document.getElementById('dashboardMain');

  try {
    statusEl.className = 'prototype-note';
    statusEl.innerHTML = 'Loading live data from the CalFresh spreadsheet…';

    const [monthlyParsed, annualParsed, pitParsed] = await Promise.all([
      fetchCsv(PUBLISHED_SHEET.monthlyGid, 'Master_Monthly'),
      fetchCsv(PUBLISHED_SHEET.annualGid, 'Master_Annual'),
      fetchCsv(PUBLISHED_SHEET.pointInTimeGid, 'Master_PointInTime')
    ]);

    const monthlyRows = mergeDualIntoMonthly(
      csvToMonthlyRows(monthlyParsed),
      csvToDualRows(pitParsed)
    );
    const payload = {
      monthly: toColumnBlock(monthlyRows, [
        'county', 'period', 'persons', 'households', 'child_only',
        'dual_medi_cal', 'dollars_issued', 'students'
      ]),
      age_bands: toColumnBlock(csvToAgeRows(annualParsed), [
        'county', 'period', 'elderly', 'a1859', 'children'
      ])
    };

    DATA = buildDashboardData(payload);
    const through = DATA.latest_complete_month ? fmtMonthShort(DATA.latest_complete_month) : null;
    statusEl.className = 'live-note';
    statusEl.innerHTML = 'Live data from <strong>CalFresh Data – Consolidated</strong>' +
      (through ? ', through ' + through : '') +
      '. Colors are still placeholders.';
    mainEl.hidden = false;
    initDashboard();
  } catch (err) {
    statusEl.className = 'prototype-note error-note';
    statusEl.innerHTML = '<strong>Could not load live spreadsheet data.</strong> ' +
      String(err.message || err);
  }
}
