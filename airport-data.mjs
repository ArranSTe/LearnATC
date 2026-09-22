import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const cacheDir = fileURLToPath(new URL('./.cache/', import.meta.url));
const cacheFile = `${cacheDir}/airports.json`;
const source = 'https://davidmegginson.github.io/ourairports-data/';
const maxAge = 24 * 60 * 60 * 1000;
let database;
let pending;
let lastAttempt = 0;

// Handles quoted commas, escaped quotes, CRLF, and multiline CSV fields.
export function parseCSV(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { if (quoted && text[i + 1] === '"') {cell += '"'; i++;} else quoted = !quoted; }
    else if (ch === ',' && !quoted) {row.push(cell); cell = '';}
    else if ((ch === '\n' || ch === '\r') && !quoted) { if (ch === '\r' && text[i+1] === '\n') i++; row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) {row.push(cell); rows.push(row);}
  const headings = rows.shift() || [];
  return rows.map(values => Object.fromEntries(headings.map((key, index) => [key.replace(/^\uFEFF/, ''), values[index] || ''])));
}
const numeric = value => value !== '' && value != null && Number.isFinite(Number(value)) ? Number(value) : null;
export function combineData(airports, runways, countries) {
  const names = new Map(countries.map(c => [c.code, c.name]));
  const byAirport = new Map();
  for (const r of runways) {
    if (r.closed === '1' || /^H/i.test(r.le_ident)) continue;
    const list = byAirport.get(r.airport_ident) || [];
    list.push({ends:[r.le_ident,r.he_ident].filter(Boolean).join(' / ') || 'Unlisted',lengthFt:numeric(r.length_ft),widthFt:numeric(r.width_ft),surface:r.surface || 'Unknown',lighted:r.lighted === '1'});
    byAirport.set(r.airport_ident, list);
  }
  return airports.filter(a => /^[A-Z]{4}$/.test(a.icao_code) && ['large_airport','medium_airport','small_airport'].includes(a.type)).map(a => ({
    icao:a.icao_code, iata:a.iata_code, name:a.name, city:a.municipality, country:names.get(a.iso_country) || a.iso_country,
    type:a.type, latitude:numeric(a.latitude_deg), longitude:numeric(a.longitude_deg), elevationFt:numeric(a.elevation_ft),
    runways:(byAirport.get(a.ident) || []).sort((a,b) => (b.lengthFt || 0) - (a.lengthFt || 0))
  }));
}
export function searchAirports(airports, query, limit = 8) {
  const q = query.toUpperCase();
  const rank = {large_airport:0,medium_airport:1,small_airport:2};
  return airports.filter(a => a.icao.startsWith(q)).sort((a,b) => Number(b.icao === q)-Number(a.icao === q) || rank[a.type]-rank[b.type] || a.icao.localeCompare(b.icao)).slice(0,limit);
}
async function refresh() {
  lastAttempt = Date.now();
  const csv = await Promise.all(['airports.csv','runways.csv','countries.csv'].map(async name => {
    const response = await fetch(source + name, {signal:AbortSignal.timeout(30000)});
    if (!response.ok) throw new Error(`Airport source returned ${response.status}`);
    const text = await response.text();
    if (!text.startsWith('"id"') && !text.startsWith('id,')) throw new Error('Invalid airport data');
    return parseCSV(text);
  }));
  const airports = combineData(...csv);
  if (airports.length < 1000 || !airports.some(a => a.icao === 'EGLL' && a.runways.length)) throw new Error('Incomplete airport data');
  database = {updatedAt:new Date().toISOString(),source:'OurAirports',airports};
  await mkdir(cacheDir,{recursive:true});
  await writeFile(cacheFile+'.tmp',JSON.stringify(database));
  await rename(cacheFile+'.tmp',cacheFile);
  console.log(`Airport API ready: ${airports.length} airports.`);
  return database;
}
export async function getDatabase() {
  if (!database) {
    try {const cached = JSON.parse(await readFile(cacheFile,'utf8')); if (cached.airports?.length > 1000 && Number.isFinite(Date.parse(cached.updatedAt))) database = cached;} catch {}
  }
  if (!database || (Date.now()-Date.parse(database.updatedAt)>maxAge && Date.now()-lastAttempt>60000)) {
    pending ||= refresh().finally(()=>{pending = null;});
    if (!database) return pending;
    pending.catch(error=>console.warn('Using cached airport reference data:',error.message));
  }
  return database;
}
