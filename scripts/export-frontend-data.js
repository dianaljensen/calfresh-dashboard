#!/usr/bin/env node
// Pull the published Sheet CSVs, keep only the columns the charts use, and
// write /data/*.json. GitHub Actions runs this daily; the public site loads
// those files instead of waiting on Google Sheets. The Sheet stays the source
// of truth — this is just a faster copy.

'use strict';

const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

global.Papa = Papa;

const core = require('../data.js');
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data');

function publishedCsvUrl(gid) {
  return core.PUBLISHED_SHEET.base + '/pub?gid=' + gid + '&single=true&output=csv';
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

function slimParsed(parsed, keepFields) {
  const keep = keepFields.filter(Boolean);
  const rows = parsed.data.map(row => {
    const slim = {};
    let any = false;
    keep.forEach(field => {
      const val = row[field];
      if (val == null || val === '') return;
      slim[field] = val;
      any = true;
    });
    return any ? slim : null;
  }).filter(Boolean);
  return { fields: keep, rows: rows };
}

function compactValue(v) {
  if (v == null) return undefined;
  if (Array.isArray(v)) {
    return v.map(compactValue);
  }
  if (typeof v === 'object') {
    const out = {};
    Object.keys(v).forEach(k => {
      const inner = compactValue(v[k]);
      if (inner === undefined) return;
      if (typeof inner === 'object' && !Array.isArray(inner) && Object.keys(inner).length === 0) return;
      out[k] = inner;
    });
    return out;
  }
  return v;
}

function compactRows(rows) {
  return rows.map(compactValue);
}

function writePack(name, payload) {
  const body = Object.assign({ generatedAt: new Date().toISOString() }, payload);
  const dest = path.join(OUT_DIR, name + '.json');
  fs.writeFileSync(dest, JSON.stringify(body));
  const kb = Math.round(fs.statSync(dest).size / 1024);
  console.log('  wrote data/' + name + '.json (' + kb + ' KB, ' +
    (payload.rows ? payload.rows.length + ' rows' : 'ok') + ')');
}

function writeCsv(name, fields, rows) {
  const csv = Papa.unparse({
    fields: fields,
    data: rows.map(row => fields.map(f => (row[f] == null ? '' : row[f])))
  });
  const dest = path.join(OUT_DIR, name + '.csv');
  fs.writeFileSync(dest, csv);
  const kb = Math.round(fs.statSync(dest).size / 1024);
  console.log('  wrote data/' + name + '.csv (' + kb + ' KB, ' + rows.length + ' rows)');
}

async function main() {
  const gids = core.PUBLISHED_SHEET;
  console.log('Fetching published Sheet CSVs...');
  const started = Date.now();
  const [monthlyText, annualText, pitText, cf296Text, legacyText, cf18Text, quarterlyText] =
    await Promise.all([
      fetchCsvText(gids.monthlyGid, 'Master_Monthly'),
      fetchCsvText(gids.annualGid, 'Master_Annual'),
      fetchCsvText(gids.pointInTimeGid, 'Master_PointInTime'),
      fetchCsvText(gids.cf296Gid, 'CF296'),
      fetchCsvText(gids.cf296LegacyGid, 'CF296_Legacy'),
      fetchCsvText(gids.cf18Gid, 'CF18'),
      fetchCsvText(gids.quarterlyGid, 'Master_Quarterly')
    ]);
  console.log('Fetched in ' + ((Date.now() - started) / 1000).toFixed(1) + 's. Parsing...');

  const monthlyParsed = core.parseCsv(monthlyText, 'Master_Monthly');
  const annualParsed = core.parseCsv(annualText, 'Master_Annual');
  const pitParsed = core.parseCsv(pitText, 'Master_PointInTime');
  const cf296Parsed = core.parseCsv(cf296Text, 'CF296');
  const legacyParsed = core.parseCsv(legacyText, 'CF296_Legacy');
  const cf18Parsed = core.parseCsv(cf18Text, 'CF18');
  const quarterlyParsed = core.parseCsv(quarterlyText, 'Master_Quarterly');

  const monthlyRows = core.mergeDualIntoMonthly(
    core.csvToMonthlyRows(monthlyParsed),
    core.csvToDualRows(pitParsed)
  );
  const keep = core.monthlyParserKeepFields(monthlyParsed.meta.fields);
  if (!keep.length) throw new Error('Master_Monthly keep-list was empty.');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const generatedAt = new Date().toISOString();
  writePack('meta', { generatedAt: generatedAt });
  writePack('monthly-rows', { rows: compactRows(monthlyRows) });
  writePack('age-rows', { rows: compactRows(core.csvToAgeRows(annualParsed)) });
  writePack('outcome-rows', {
    rows: compactRows(core.parseCf296OutcomeRows(legacyParsed, cf296Parsed))
  });
  const slimMonthly = slimParsed(monthlyParsed, keep);
  writeCsv('master-monthly', slimMonthly.fields, slimMonthly.rows);
  writePack('cf18-days-rows', { rows: compactRows(core.csvToCf18DaysRows(cf18Parsed)) });
  writePack('cf18-churn-rows', { rows: core.csvToCf18ChurnRows(cf18Parsed) });
  writePack('quarterly-days-rows', {
    rows: compactRows(core.csvToQuarterlyDaysRows(quarterlyParsed))
  });
  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
