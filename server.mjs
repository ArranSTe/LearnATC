import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getDatabase, searchAirports } from './airport-data.mjs';
import { getDepartures } from './departure-data.mjs';
const root = fileURLToPath(new URL('./dist/',import.meta.url));
const port = Number(process.env.PORT || 4317);
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.svg':'image/svg+xml','.png':'image/png'};
function json(res,status,body) {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
const server=http.createServer(async (req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  try {
    if (!['GET','HEAD'].includes(req.method)) {res.setHeader('Allow','GET, HEAD');return json(res,405,{error:'Method not allowed.'});}
    const url = new URL(req.url,'http://localhost');
    if (url.pathname === '/api/departures') {
      const airport=(url.searchParams.get('airport') || '').toUpperCase();
      const runway=(url.searchParams.get('runway') || '').toUpperCase();
      if (!/^[A-Z]{4}$/.test(airport) || !/^(0[1-9]|[12]\d|3[0-6])[LRC]?$/.test(runway)) return json(res,400,{error:'Choose an airport and runway.'});
      try {return json(res,200,await getDepartures(airport,runway));}
      catch {return json(res,503,{error:'Departure lookup unavailable. Retry or enter the departure assigned by ATC.'});}
    }
    if (url.pathname === '/api/airports' || url.pathname.startsWith('/api/airports/')) {
      const isSearch=url.pathname === '/api/airports';
      const query=(isSearch ? url.searchParams.get('q') || '' : decodeURIComponent(url.pathname.slice('/api/airports/'.length))).trim().toUpperCase();
      if (!(isSearch ? /^[A-Z]{1,4}$/ : /^[A-Z]{4}$/).test(query)) return json(res,400,{error:'Enter '+(isSearch?'1–4':'4')+' letters of an ICAO code.'});
      try {
        const db=await getDatabase();
        const data=isSearch?searchAirports(db.airports,query):db.airports.find(a=>a.icao===query);
        if (!data) return json(res,404,{error:'Airport not found.'});
        return json(res,200,{data,source:db.source,updatedAt:db.updatedAt,stale:Date.now()-Date.parse(db.updatedAt)>86400000});
      } catch {return json(res,503,{error:'Airport lookup is temporarily unavailable. Please try again.'});}
    }
    const pathname=decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file=path.resolve(root,'.'+pathname);
    if (!file.startsWith(root)) return json(res,403,{error:'Forbidden'});
    try {const content=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:content);}
    catch {json(res,404,{error:'Page not found.'});}
  } catch {json(res,400,{error:'Invalid request.'});}
});
server.listen(port,'127.0.0.1',()=>console.log(`LearnATC: http://127.0.0.1:${port}`));
getDatabase().catch(error=>console.warn('Airport lookup will retry when requested:',error.message));
