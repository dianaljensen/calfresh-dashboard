// Live spreadsheet feed for the participation view.
// Fetches the Publish-to-web CSV for specific tabs of "CalFresh Data - Consolidated".
// That 2PACX URL is public; spreadsheet-ID gviz URLs are not (they 401 unless signed in).

const PUBLISHED_SHEET = {
  base: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTFzUHnRs-aXlIQhySWVRbTPZtSkM3--uskf8F3dCxnsEXRoIWePnuL8KoigtOP6W-hh22xLDNfivRK',
  monthlyGid: '447670588',      // Master_Monthly
  annualGid: '1345412068',       // Master_Annual
  pointInTimeGid: '1435977340',  // Master_PointInTime (dual Medi-Cal enrollment)
  cf296Gid: '1704035547',        // CF296 (FY2025-26+, 135 cells)
  cf296LegacyGid: '1152285266'  // CF296_Legacy (FY2016-17 through FY2024-25)
};

// 100% stacked composition of applications disposed. Order is bottom-to-top
// (approved at the base), matching the original Tableau Application Outcomes tab.
const OUTCOME_STACK = [
  { key: 'approved', label: 'Approved', color: '#4BA5BA' },
  { key: 'withdrawn', label: 'Withdrawn', color: '#C0C0C0' },
  { key: 'ineligible', label: 'Denied — ineligible', color: '#6A6A6A' },
  { key: 'procedural', label: 'Denied — procedural', color: '#FB7906' }
];

const STUDENT_OUTCOME_STACK = [
  { key: 'approved', label: 'Approved', color: '#4BA5BA' },
  { key: 'denied', label: 'Denied', color: '#6A6A6A' },
  { key: 'pended', label: 'Pended', color: '#C4D6E4' }
];

const OUTCOME_COUNT_KEYS = ['disposed', 'approved', 'ineligible', 'procedural', 'withdrawn'];
const OUTCOME_PART_KEYS = ['approved', 'ineligible', 'procedural', 'withdrawn'];
const STUDENT_OUTCOME_PART_KEYS = ['approved', 'denied', 'pended'];
const MOVEMENT_KEYS = ['caseApproved', 'reinstated', 'discontinued'];
// CDSS stars both true 1–10 cells and complementary totals ≥11. Identity
// reconstruction fills the latter; leftover 1–10 cells are plotted as 5.
const SMALL_CELL_PLACEHOLDER = 5;
const SMALL_CELL_MAX = 10;

const MONTH_NUMBERS = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12',
  jan: '01', feb: '02', mar: '03', apr: '04', jun: '06',
  jul: '07', aug: '08', sep: '09', sept: '09', oct: '10', nov: '11', dec: '12'
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
    label: 'College students',
    description: "College students on CalFresh, from Master_Monthly's 'Caseload Total Student Count' column (a caseload characteristic, not a separate program). Reported monthly from Jan 2023 onward, with no data before that.",
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
  caveat: "Age groups are a July snapshot each year, so a jump in July is CDSS publishing the new annual numbers — not a sudden enrollment change. Each July reading holds flat until the next July. Age bands: 60+ = 60 and older, Children = under 18."
};

// CDSS reporting holes treated as missing rather than real cliffs. Applied here
// on every live refresh so they don't disappear the way they would if they
// lived only in a static snapshot (see TODO.md, Feb 2019 data gap).
// Manual extras are a floor; findIsolatedPersonGaps() adds the same pattern
// whenever a new one-month drop-and-rebound (or spike-and-rebound) shows up.
const PERSONS_GAPS = {
  ALL: ['2019-02'],
  Sonoma: ['2019-04']
};

// Isolated one-month errors: far from both neighbors, while the neighbors
// agree with each other. Real policy shifts fail this test because the new
// level persists. 40% / 10% catches Feb 2019, Sonoma Apr 2019, Marin May 2021,
// and later single-county zeros without flagging COVID, SSI eligibility, or
// the emergency-allotment sunset. The newest month cannot be judged until
// the following month is published.
const GAP_MIN_DEVIATION = 0.40;
const GAP_MAX_NEIGHBOR_CHANGE = 0.10;
const GAP_WIDESPREAD_SHARE = 0.5;

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
  // Published-sheet currency cells come through as "$32,426,318". Commas and
  // percent signs are stripped for the same reason.
  const n = Number(String(v).trim().replace(/[$,%]/g, ''));
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

async function fetchCsvText(gid, label) {
  const res = await fetch(publishedCsvUrl(gid), { redirect: 'follow' });
  if (!res.ok) throw new Error(label + ' returned HTTP ' + res.status);
  const text = await res.text();
  if (/^\s*<!DOCTYPE html/i.test(text) || text.indexOf('show-login') !== -1) {
    throw new Error(label + ' came back as a login page, not CSV. Check Publish to web is still on.');
  }
  return text;
}

async function fetchCsv(gid, label) {
  return parseCsv(await fetchCsvText(gid, label), label);
}

// Publish-to-web CSVs (especially Master_Monthly) are large and slow. Keep a
// copy in IndexedDB so reloads can paint from disk, then refresh in the background.
const CSV_CACHE_DB = 'calfresh-csv-v1';
const CSV_CACHE_STORE = 'csv';
const MONTHLY_ROWS_KEY = 'monthly-rows-v1';
const COUNTY_META_KEY = 'county-meta-v1';
const csvRefreshInflight = {};
let csvCacheDbPromise = null;

function openCsvCacheDb() {
  if (csvCacheDbPromise) return csvCacheDbPromise;
  csvCacheDbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const req = indexedDB.open(CSV_CACHE_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CSV_CACHE_STORE)) {
        db.createObjectStore(CSV_CACHE_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    setTimeout(() => reject(new Error('IndexedDB open timed out')), 1500);
  }).catch(err => {
    csvCacheDbPromise = null;
    throw err;
  });
  return csvCacheDbPromise;
}

async function csvCacheGet(key) {
  try {
    const db = await openCsvCacheDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(CSV_CACHE_STORE, 'readonly');
      const req = tx.objectStore(CSV_CACHE_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    return null;
  }
}

async function csvCacheSet(key, record) {
  try {
    const db = await openCsvCacheDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(CSV_CACHE_STORE, 'readwrite');
      tx.objectStore(CSV_CACHE_STORE).put(record, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Could not save spreadsheet cache:', err);
  }
}

function fmtSavedAt(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });
}

function setFeedStatus(statusEl, opts) {
  const through = opts.through;
  const source = opts.sourceLabel || 'CalFresh Data – Consolidated';
  let html = 'Live data from <strong>' + source + '</strong>' +
    (through ? ', through ' + through : '') + '.';
  if (opts.fromCache) {
    html += ' Loaded from this browser’s saved copy' +
      (opts.fetchedAt ? ' (' + fmtSavedAt(opts.fetchedAt) + ')' : '') +
      '.';
  }
  statusEl.className = 'live-note';
  statusEl.innerHTML = html;
}

function refreshCsvInBackground(gid, label) {
  if (csvRefreshInflight[gid]) return csvRefreshInflight[gid];
  csvRefreshInflight[gid] = fetchCsvText(gid, label).then(async text => {
    const prev = await csvCacheGet(gid);
    if (!prev || prev.text !== text) {
      await csvCacheSet(gid, { text: text, fetchedAt: Date.now() });
    }
    if (gid === PUBLISHED_SHEET.monthlyGid) {
      const rows = csvToMonthlyRows(parseCsv(text, label));
      await csvCacheSet(MONTHLY_ROWS_KEY, { text: JSON.stringify(rows), fetchedAt: Date.now() });
      await csvCacheSet(COUNTY_META_KEY, {
        text: JSON.stringify(countyMetaFromMonthlyRows(rows)),
        fetchedAt: Date.now()
      });
    }
  }).catch(err => {
    console.warn('Background spreadsheet refresh failed for ' + label + ':', err);
  }).finally(() => {
    csvRefreshInflight[gid] = null;
  });
  return csvRefreshInflight[gid];
}

async function loadCsv(gid, label) {
  const cached = await csvCacheGet(gid);
  if (cached && cached.text) {
    refreshCsvInBackground(gid, label);
    return {
      parsed: parseCsv(cached.text, label),
      fromCache: true,
      fetchedAt: cached.fetchedAt
    };
  }
  const text = await fetchCsvText(gid, label);
  const fetchedAt = Date.now();
  csvCacheSet(gid, { text: text, fetchedAt: fetchedAt });
  return {
    parsed: parseCsv(text, label),
    fromCache: false,
    fetchedAt: fetchedAt
  };
}

async function loadMonthlyRows() {
  const cached = await csvCacheGet(MONTHLY_ROWS_KEY);
  if (cached && cached.text) {
    refreshCsvInBackground(PUBLISHED_SHEET.monthlyGid, 'Master_Monthly');
    try {
      return {
        rows: JSON.parse(cached.text),
        fromCache: true,
        fetchedAt: cached.fetchedAt
      };
    } catch (err) {
      console.warn('Saved monthly rows could not be read:', err);
    }
  }
  const loaded = await loadCsv(PUBLISHED_SHEET.monthlyGid, 'Master_Monthly');
  const rows = csvToMonthlyRows(loaded.parsed);
  csvCacheSet(MONTHLY_ROWS_KEY, { text: JSON.stringify(rows), fetchedAt: loaded.fetchedAt });
  csvCacheSet(COUNTY_META_KEY, {
    text: JSON.stringify(countyMetaFromMonthlyRows(rows)),
    fetchedAt: loaded.fetchedAt
  });
  return { rows: rows, fromCache: loaded.fromCache, fetchedAt: loaded.fetchedAt };
}

async function loadCountyMeta() {
  const cached = await csvCacheGet(COUNTY_META_KEY);
  if (cached && cached.text) {
    loadMonthlyRows().catch(err => {
      console.warn('Background county-size refresh failed:', err);
    });
    try {
      return {
        meta: JSON.parse(cached.text),
        fromCache: true,
        fetchedAt: cached.fetchedAt
      };
    } catch (err) {
      console.warn('Saved county-size metadata could not be read:', err);
    }
  }
  const monthly = await loadMonthlyRows();
  const meta = countyMetaFromMonthlyRows(monthly.rows);
  csvCacheSet(COUNTY_META_KEY, { text: JSON.stringify(meta), fetchedAt: monthly.fetchedAt });
  return { meta: meta, fromCache: monthly.fromCache, fetchedAt: monthly.fetchedAt };
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

function findIsolatedPersonGaps(series, months, allCounties) {
  const hitsByMonth = {};
  function isolatedAt(persons, i) {
    if (i < 1 || i >= months.length - 1) return false;
    const prev = persons[months[i - 1]];
    const cur = persons[months[i]];
    const next = persons[months[i + 1]];
    if (prev == null || cur == null || next == null || prev === 0) return false;
    const mid = (prev + next) / 2;
    if (!mid) return false;
    const deviation = Math.abs(cur - mid) / mid;
    const neighbor = Math.abs(next - prev) / prev;
    return deviation >= GAP_MIN_DEVIATION && neighbor <= GAP_MAX_NEIGHBOR_CHANGE;
  }
  Object.keys(series).forEach(county => {
    const persons = series[county] && series[county].persons;
    if (!persons) return;
    months.forEach((m, i) => {
      if (!isolatedAt(persons, i)) return;
      if (!hitsByMonth[m]) hitsByMonth[m] = [];
      hitsByMonth[m].push(county);
    });
  });

  const allMonths = [];
  const byCounty = {};
  Object.keys(hitsByMonth).sort().forEach(m => {
    const flaggedCounties = hitsByMonth[m].filter(c => c !== 'Statewide');
    const withData = allCounties.filter(c => {
      const v = series[c] && series[c].persons && series[c].persons[m];
      return v != null;
    }).length;
    if (withData && flaggedCounties.length / withData >= GAP_WIDESPREAD_SHARE) {
      allMonths.push(m);
    } else {
      hitsByMonth[m].forEach(c => {
        if (!byCounty[c]) byCounty[c] = [];
        byCounty[c].push(m);
      });
    }
  });
  return { allMonths: allMonths, byCounty: byCounty };
}

function mergeManualGaps(found) {
  const allMonths = found.allMonths.slice();
  (PERSONS_GAPS.ALL || []).forEach(m => {
    if (allMonths.indexOf(m) === -1) allMonths.push(m);
  });
  allMonths.sort();
  const byCounty = {};
  Object.keys(found.byCounty).forEach(c => { byCounty[c] = found.byCounty[c].slice(); });
  Object.keys(PERSONS_GAPS).forEach(c => {
    if (c === 'ALL') return;
    (PERSONS_GAPS[c] || []).forEach(m => {
      if (allMonths.indexOf(m) !== -1) return;
      if (!byCounty[c]) byCounty[c] = [];
      if (byCounty[c].indexOf(m) === -1) byCounty[c].push(m);
    });
  });
  return { allMonths: allMonths, byCounty: byCounty };
}

function applyReportingGaps(series, months, allCounties) {
  const gaps = mergeManualGaps(findIsolatedPersonGaps(series, months, allCounties));
  Object.keys(series).forEach(county => {
    if (!series[county].persons) return;
    const extra = gaps.byCounty[county] || [];
    gaps.allMonths.concat(extra).forEach(month => {
      series[county].persons[month] = null;
    });
  });
  return gaps;
}

function describeReportingGapsThisRefresh(gaps) {
  const parts = [];
  (gaps.allMonths || []).forEach(m => {
    parts.push(fmtMonthShort(m) + ' (all counties)');
  });
  const byMonth = {};
  Object.keys(gaps.byCounty || {}).forEach(c => {
    (gaps.byCounty[c] || []).forEach(m => {
      if (!byMonth[m]) byMonth[m] = [];
      byMonth[m].push(c === 'Statewide' ? 'California' : c);
    });
  });
  Object.keys(byMonth).sort().forEach(m => {
    parts.push(fmtMonthShort(m) + ' (' + byMonth[m].slice().sort().join(', ') + ')');
  });
  return parts.length ? 'This refresh: ' + parts.join('; ') + '.' : '';
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

  const months = Array.from(monthsSet).sort();
  const all_counties = Array.from(countiesSet).sort();
  const reportingGaps = applyReportingGaps(series, months, all_counties);
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
    reporting_gaps: reportingGaps,
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

function isCf296TotalHeader(header) {
  const last = normalizeHeader(header).split('|').pop().trim();
  return last === 'total' || last === 'total (c)' || last === 'c. total';
}

function findCf296Field(fields, includeAll, excludeAny) {
  const matches = (fields || []).filter(f => {
    const n = normalizeHeader(f);
    if (!includeAll.every(s => n.indexOf(normalizeHeader(s)) !== -1)) return false;
    if ((excludeAny || []).some(s => n.indexOf(normalizeHeader(s)) !== -1)) return false;
    return isCf296TotalHeader(f);
  });
  if (!matches.length) return null;
  if (matches.length === 1) return matches[0];
  const partA = matches.filter(f => /(?:^|:\s*)(?:part a\.|a\. applications for calfresh)/i.test(f));
  return (partA.length ? partA[0] : matches[0]);
}

function parseCf296Period(reportMonth, dateVal) {
  const rm = String(reportMonth == null ? '' : reportMonth).trim();
  if (rm) {
    const mdy = rm.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (mdy) {
      let y = mdy[3];
      if (y.length === 2) y = (parseInt(y, 10) >= 90 ? '19' : '20') + y;
      return y + '-' + String(mdy[1]).padStart(2, '0');
    }
    const named = rm.match(/^([A-Za-z]+)\s+(\d{4})$/);
    if (named) return buildPeriod(named[1], named[2]);
    const iso = rm.match(/^(\d{4})-(\d{2})/);
    if (iso) return iso[1] + '-' + iso[2];
  }
  const d = String(dateVal == null ? '' : dateVal).trim();
  const compact = d.match(/^([A-Za-z]{3,9})[-\s]?(\d{2}|\d{4})$/);
  if (compact) {
    let y = compact[2];
    if (y.length === 2) y = (parseInt(y, 10) >= 90 ? '19' : '20') + y;
    return buildPeriod(compact[1], y);
  }
  return null;
}

function resolveOutcomeCounts(raw) {
  const counts = {};
  OUTCOME_COUNT_KEYS.forEach(k => { counts[k] = raw[k]; });
  const estimated = {};
  const missing = OUTCOME_COUNT_KEYS.filter(k => counts[k] == null);

  function sumParts() {
    return OUTCOME_PART_KEYS.reduce((s, p) => s + counts[p], 0);
  }

  if (missing.length === 1) {
    const k = missing[0];
    const recovered = k === 'disposed'
      ? sumParts()
      : counts.disposed - OUTCOME_PART_KEYS.filter(p => p !== k).reduce((s, p) => s + counts[p], 0);
    if (recovered > SMALL_CELL_MAX) {
      counts[k] = recovered;
    } else if (recovered === 0) {
      counts[k] = 0;
    } else if (recovered > 0 && recovered <= SMALL_CELL_MAX) {
      counts[k] = SMALL_CELL_PLACEHOLDER;
      estimated[k] = true;
    }
  } else if (missing.length > 1) {
    const known = OUTCOME_COUNT_KEYS.map(k => counts[k]).filter(v => v != null);
    const allSmall = known.length > 0 && known.every(v => v <= SMALL_CELL_MAX);
    if (allSmall) {
      OUTCOME_PART_KEYS.forEach(p => {
        if (counts[p] == null) {
          counts[p] = SMALL_CELL_PLACEHOLDER;
          estimated[p] = true;
        }
      });
      if (counts.disposed == null && OUTCOME_PART_KEYS.every(p => counts[p] != null)) {
        counts.disposed = sumParts();
      }
    }
  }
  return { counts, estimated };
}

function smallCellHoverNote(counts, stack) {
  if (!counts || !counts.estimated) return null;
  const names = (stack || OUTCOME_STACK).filter(s => counts.estimated[s.key]).map(s => s.label);
  if (!names.length) return null;
  if (names.length === 1) return names[0] + ': fewer than 11; plotted as 5.';
  const last = names[names.length - 1];
  return names.slice(0, -1).join(', ') + ' and ' + last + ': fewer than 11; plotted as 5.';
}

function parseStarredNumber(v) {
  if (v == null) return { value: null, estimated: false };
  const s = String(v).trim();
  if (s === '*') return { value: SMALL_CELL_PLACEHOLDER, estimated: true };
  const n = parseNumber(s);
  return { value: n, estimated: false };
}

function csvToStudentOutcomeRows(parsed) {
  const fields = parsed.meta.fields || [];
  const map = headerMap(fields);
  const countyCol = findCol(map, ['County']);
  const monthCol = findCol(map, ['Month']);
  const yearCol = findCol(map, ['Calendar Year']);
  const cols = {
    approved: findCol(map, ['Applications Approved Containing at Least One Student']),
    denied: findCol(map, ['Applications Denied Containing at Least One Student']),
    pended: findCol(map, ['Applications Pended Containing at Least One Student'])
  };
  if (!countyCol || !monthCol || !yearCol || !cols.approved || !cols.denied || !cols.pended) {
    throw new Error('Master_Monthly is missing student application outcome columns.');
  }

  return parsed.data.map(row => {
    const county = normalizeCountyName(row[countyCol]);
    const period = buildPeriod(row[monthCol], row[yearCol]);
    if (!county || !period) return null;
    const approved = parseStarredNumber(row[cols.approved]);
    const denied = parseStarredNumber(row[cols.denied]);
    const pended = parseStarredNumber(row[cols.pended]);
    if (approved.value == null && denied.value == null && pended.value == null) return null;
    if (approved.value == null || denied.value == null || pended.value == null) return null;
    const estimated = {};
    if (approved.estimated) estimated.approved = true;
    if (denied.estimated) estimated.denied = true;
    if (pended.estimated) estimated.pended = true;
    return {
      county: county,
      period: period,
      approved: approved.value,
      denied: denied.value,
      pended: pended.value,
      disposed: approved.value + denied.value + pended.value,
      estimated: estimated
    };
  }).filter(Boolean);
}

function buildStudentSeries(studentRows, months, all_counties) {
  const series = {};
  function ensure(county) {
    if (!series[county]) {
      series[county] = {
        approved: {}, denied: {}, pended: {}, disposed: {},
        estimated: { approved: {}, denied: {}, pended: {} }
      };
    }
    return series[county];
  }
  (studentRows || []).forEach(r => {
    const s = ensure(r.county);
    STUDENT_OUTCOME_PART_KEYS.forEach(k => { s[k][r.period] = r[k]; });
    s.disposed[r.period] = r.disposed;
    STUDENT_OUTCOME_PART_KEYS.forEach(k => {
      if (r.estimated && r.estimated[k]) s.estimated[k][r.period] = true;
    });
  });
  const entities = ['Statewide'].concat(all_counties || []);
  entities.forEach(county => {
    const s = ensure(county);
    (months || []).forEach(m => {
      STUDENT_OUTCOME_PART_KEYS.forEach(k => {
        if (s[k][m] === undefined) s[k][m] = null;
      });
      if (s.disposed[m] === undefined) s.disposed[m] = null;
    });
  });
  return series;
}

function csvToOutcomeRows(parsed, label) {
  const fields = parsed.meta.fields || [];
  const map = headerMap(fields);
  const countyCol = findCol(map, ['County Name', 'County']);
  const reportMonthCol = findCol(map, ['Report Month']);
  const dateCol = findCol(map, ['Date']);
  const cols = {
    disposed: findCf296Field(fields, ['applications disposed of during the month'], ['recertification']),
    approved: findCf296Field(fields, ['applications approved'], [
      'over 30', 'overdue', 'certified caseload', '5.a', '5a.', 'item 5'
    ]),
    ineligible: findCf296Field(fields, ['denied because determined ineligible'], ['recertification']),
    procedural: findCf296Field(fields, ['denied for procedural reasons'], []),
    withdrawn: findCf296Field(fields, ['applications withdrawn'], ['recertification']),
    received: findCf296Field(fields, ['applications received during the month'], ['online']),
    caseApproved: findCf296Field(fields, ['certified caseload', 'applications approved'], [
      '5.a.1', '5a.1', 'overdue', 'over 30'
    ]),
    reinstated: findCf296Field(fields, ['eligibility reinstated'], []),
    discontinued: findCf296Field(fields, ['cases discontinued during the month'], [
      'failure to complete', 'expedited'
    ])
  };
  const missing = Object.keys(cols).filter(k => k !== 'received' && !cols[k]);
  if (!countyCol || missing.length) {
    throw new Error(label + ' is missing expected CF296 columns' +
      (missing.length ? ' (' + missing.join(', ') + ')' : '') + '.');
  }

  return parsed.data.map(row => {
    const county = normalizeCountyName(row[countyCol]);
    const period = parseCf296Period(
      reportMonthCol ? row[reportMonthCol] : '',
      dateCol ? row[dateCol] : ''
    );
    if (!county || !period) return null;
    const rec = {
      county: county,
      period: period,
      disposed: parseNumber(row[cols.disposed]),
      approved: parseNumber(row[cols.approved]),
      ineligible: parseNumber(row[cols.ineligible]),
      procedural: parseNumber(row[cols.procedural]),
      withdrawn: parseNumber(row[cols.withdrawn]),
      received: cols.received ? parseNumber(row[cols.received]) : null,
      caseApproved: parseNumber(row[cols.caseApproved]),
      reinstated: parseNumber(row[cols.reinstated]),
      discontinued: parseNumber(row[cols.discontinued])
    };
    const hasOut = rec.disposed != null || rec.approved != null || rec.ineligible != null ||
      rec.procedural != null || rec.withdrawn != null;
    const hasMove = rec.caseApproved != null || rec.reinstated != null || rec.discontinued != null;
    if (!hasOut && !hasMove && rec.received == null) return null;
    if (hasOut) {
      const resolved = resolveOutcomeCounts(rec);
      OUTCOME_COUNT_KEYS.forEach(k => { rec[k] = resolved.counts[k]; });
      rec.estimated = resolved.estimated;
    } else {
      rec.estimated = {};
    }
    return rec;
  }).filter(Boolean);
}

function countyMetaFromMonthlyRows(monthlyRows) {
  const households = {};
  const monthsSet = new Set();
  monthlyRows.forEach(r => {
    if (!r.county || r.county === 'Statewide' || r.households == null) return;
    if (!households[r.county]) households[r.county] = {};
    households[r.county][r.period] = r.households;
    monthsSet.add(r.period);
  });
  const months = Array.from(monthsSet).sort();
  let latest = months[months.length - 1] || null;
  // Prefer a month where most counties have a reading.
  for (let i = months.length - 1; i >= 0; i--) {
    const m = months[i];
    const n = Object.keys(households).filter(c => households[c][m] != null).length;
    if (n >= 50) { latest = m; break; }
  }
  const all_counties = Object.keys(households).sort();
  const ranked = all_counties
    .map(c => ({ c: c, h: (households[c] && households[c][latest]) || 0 }))
    .sort((a, b) => b.h - a.h);
  const xlarge = {};
  ranked.slice(0, 6).forEach(row => { xlarge[row.c] = true; });
  const county_meta = {};
  all_counties.forEach(c => {
    const h = (households[c] && households[c][latest]) || 0;
    let size = 'Small';
    if (xlarge[c]) size = 'X-Large';
    else if (h > 25000) size = 'Large';
    else if (h >= 5000) size = 'Medium';
    county_meta[c] = { households_latest: h, size: size };
  });
  return county_meta;
}

function buildOutcomesData(outcomeRows, county_meta) {
  const series = {};
  const countiesSet = new Set();
  const monthsSet = new Set();

  function ensure(county) {
    if (!series[county]) {
      series[county] = {
        disposed: {}, approved: {}, ineligible: {}, procedural: {}, withdrawn: {},
        received: {},
        caseApproved: {}, reinstated: {}, discontinued: {},
        estimated: { approved: {}, ineligible: {}, procedural: {}, withdrawn: {} }
      };
    }
    return series[county];
  }

  outcomeRows.forEach(r => {
    monthsSet.add(r.period);
    if (r.county !== 'Statewide') countiesSet.add(r.county);
    const s = ensure(r.county);
    OUTCOME_COUNT_KEYS.forEach(k => {
      if (r[k] != null) s[k][r.period] = r[k];
    });
    if (r.received != null) s.received[r.period] = r.received;
    MOVEMENT_KEYS.forEach(k => {
      if (r[k] != null) s[k][r.period] = r[k];
    });
    OUTCOME_PART_KEYS.forEach(k => {
      if (r.estimated && r.estimated[k]) s.estimated[k][r.period] = true;
    });
  });

  const months = Array.from(monthsSet).sort();
  const all_counties = Array.from(countiesSet).sort();
  const entities = ['Statewide'].concat(all_counties);
  entities.forEach(county => {
    const s = ensure(county);
    months.forEach(m => {
      OUTCOME_COUNT_KEYS.forEach(k => {
        if (s[k][m] === undefined) s[k][m] = null;
      });
      MOVEMENT_KEYS.forEach(k => {
        if (s[k][m] === undefined) s[k][m] = null;
      });
      if (s.received[m] === undefined) s.received[m] = null;
    });
  });

  let latest_complete_month = months[months.length - 1] || null;
  for (let i = months.length - 1; i >= 0; i--) {
    const s = series.Statewide;
    if (s && s.disposed[months[i]] != null) {
      latest_complete_month = months[i];
      break;
    }
  }

  const meta = county_meta || {};
  all_counties.forEach(c => {
    if (!meta[c]) meta[c] = { households_latest: 0, size: 'Small' };
  });

  return {
    months: months,
    latest_complete_month: latest_complete_month,
    series: series,
    student_series: {},
    county_meta: meta,
    all_counties: all_counties,
    stack: OUTCOME_STACK,
    student_stack: STUDENT_OUTCOME_STACK
  };
}

function stackPartKeys(stack) {
  return (stack || OUTCOME_STACK).map(s => s.key);
}

function estimatedFlagsFor(seriesRow, period, partKeys) {
  const estimated = {};
  const keys = partKeys || OUTCOME_PART_KEYS;
  if (!seriesRow || !seriesRow.estimated) return estimated;
  keys.forEach(k => {
    if (seriesRow.estimated[k] && seriesRow.estimated[k][period]) estimated[k] = true;
  });
  return estimated;
}

function outcomeShares(counts, stack) {
  if (!counts) return null;
  const keys = stackPartKeys(stack);
  const parts = [];
  for (let i = 0; i < keys.length; i++) {
    const v = counts[keys[i]];
    if (v == null) return null;
    parts.push(v);
  }
  const anyEstimated = counts.estimated && keys.some(k => counts.estimated[k]);
  const d = anyEstimated
    ? parts.reduce((s, v) => s + v, 0)
    : (counts.disposed != null ? counts.disposed : parts.reduce((s, v) => s + v, 0));
  if (d == null || d === 0) return null;
  const out = {};
  keys.forEach((k, i) => { out[k] = (parts[i] / d) * 100; });
  return out;
}

function sumOutcomeCounts(memberCounties, period, series, stack) {
  const parts = stackPartKeys(stack);
  const keys = parts.indexOf('disposed') === -1 ? ['disposed'].concat(parts) : parts.slice();
  const sums = {};
  keys.forEach(k => { sums[k] = 0; });
  const estimated = {};
  let any = false;
  for (let i = 0; i < memberCounties.length; i++) {
    const s = series[memberCounties[i]];
    if (!s) continue;
    let rowOk = true;
    const row = {};
    for (let k = 0; k < parts.length; k++) {
      const v = s[parts[k]][period];
      if (v == null) { rowOk = false; break; }
      row[parts[k]] = v;
    }
    if (!rowOk) continue;
    if (s.disposed && s.disposed[period] != null) row.disposed = s.disposed[period];
    else row.disposed = parts.reduce((t, k) => t + row[k], 0);
    any = true;
    keys.forEach(k => { sums[k] += row[k]; });
    const flags = estimatedFlagsFor(s, period, parts);
    parts.forEach(k => { if (flags[k]) estimated[k] = true; });
  }
  if (!any) return null;
  sums.estimated = estimated;
  return sums;
}

function deriveMovement(caseApproved, reinstated, discontinued) {
  const additions = (caseApproved == null || reinstated == null) ? null : caseApproved + reinstated;
  const exits = discontinued == null ? null : discontinued;
  const net = (additions == null || exits == null) ? null : additions - exits;
  return {
    caseApproved: caseApproved,
    reinstated: reinstated,
    discontinued: discontinued,
    additions: additions,
    exits: exits,
    net: net
  };
}

function movementForCounty(county, period, series) {
  const s = series && series[county];
  if (!s) return null;
  return deriveMovement(s.caseApproved[period], s.reinstated[period], s.discontinued[period]);
}

function sumMovementCounts(memberCounties, period, series) {
  let caseApproved = 0, reinstated = 0, discontinued = 0;
  let any = false;
  for (let i = 0; i < memberCounties.length; i++) {
    const s = series[memberCounties[i]];
    if (!s) continue;
    const a = s.caseApproved[period];
    const r = s.reinstated[period];
    const d = s.discontinued[period];
    if (a == null || r == null || d == null) continue;
    any = true;
    caseApproved += a;
    reinstated += r;
    discontinued += d;
  }
  return any ? deriveMovement(caseApproved, reinstated, discontinued) : null;
}

async function startLiveOutcomesDashboard(initDashboard) {
  const statusEl = document.getElementById('dataStatus');
  const mainEl = document.getElementById('dashboardMain');

  try {
    statusEl.className = 'prototype-note';
    statusEl.innerHTML = 'Loading current data...';

    const [cf296Loaded, legacyLoaded, metaLoaded, monthlyLoaded] = await Promise.all([
      loadCsv(PUBLISHED_SHEET.cf296Gid, 'CF296'),
      loadCsv(PUBLISHED_SHEET.cf296LegacyGid, 'CF296_Legacy'),
      loadCountyMeta(),
      loadCsv(PUBLISHED_SHEET.monthlyGid, 'Master_Monthly')
    ]);

    const byKey = {};
    csvToOutcomeRows(legacyLoaded.parsed, 'CF296_Legacy').forEach(r => {
      byKey[r.county + '|' + r.period] = r;
    });
    // Current-era rows overwrite any overlapping legacy month.
    csvToOutcomeRows(cf296Loaded.parsed, 'CF296').forEach(r => {
      byKey[r.county + '|' + r.period] = r;
    });

    DATA = buildOutcomesData(Object.keys(byKey).map(k => byKey[k]), metaLoaded.meta || {});
    DATA.student_series = buildStudentSeries(
      csvToStudentOutcomeRows(monthlyLoaded.parsed),
      DATA.months,
      DATA.all_counties
    );
    const through = DATA.latest_complete_month ? fmtMonthShort(DATA.latest_complete_month) : null;
    setFeedStatus(statusEl, {
      through: through,
      sourceLabel: 'CalFresh Data – Consolidated',
      fromCache: cf296Loaded.fromCache && legacyLoaded.fromCache && metaLoaded.fromCache && monthlyLoaded.fromCache,
      fetchedAt: [cf296Loaded.fetchedAt, legacyLoaded.fetchedAt, metaLoaded.fetchedAt, monthlyLoaded.fetchedAt]
        .filter(Boolean).reduce((a, b) => Math.min(a, b), Infinity)
    });
    mainEl.hidden = false;
    initDashboard();
  } catch (err) {
    statusEl.className = 'prototype-note error-note';
    statusEl.innerHTML = '<strong>Could not load live spreadsheet data.</strong> ' +
      String(err.message || err);
  }
}

async function startLiveDashboard(initDashboard) {
  const statusEl = document.getElementById('dataStatus');
  const mainEl = document.getElementById('dashboardMain');

  try {
    statusEl.className = 'prototype-note';
    statusEl.innerHTML = 'Loading current data...';

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
      '.';
    const gapsNote = document.getElementById('reportingGapsNote');
    if (gapsNote) {
      const refresh = describeReportingGapsThisRefresh(DATA.reporting_gaps || {});
      gapsNote.hidden = !refresh;
      gapsNote.textContent = refresh;
    }
    mainEl.hidden = false;
    initDashboard();
  } catch (err) {
    statusEl.className = 'prototype-note error-note';
    statusEl.innerHTML = '<strong>Could not load live spreadsheet data.</strong> ' +
      String(err.message || err);
  }
}
