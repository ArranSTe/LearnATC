import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCSV,combineData,searchAirports} from '../airport-data.mjs';
test('CSV parser preserves quoted names, commas, escaped quotes and multiline fields',()=>{
  assert.deepEqual(parseCSV('id,name,city\r\n1,"Airport, East","A ""quoted"" city"\r\n2,"Two\nlines",Town'),[{id:'1',name:'Airport, East',city:'A "quoted" city'},{id:'2',name:'Two\nlines',city:'Town'}]);
});
test('joins runway data by source identifier, excludes closed facilities, and preserves unknown lengths',()=>{
  const data=combineData([{ident:'LOCAL',icao_code:'TEST',type:'small_airport',name:'Test Airport',iso_country:'GB',elevation_ft:''},{ident:'CLOSED',icao_code:'CLSD',type:'closed',name:'Closed'}],[{airport_ident:'LOCAL',closed:'0',le_ident:'09',he_ident:'27',length_ft:'',width_ft:'50',surface:'GRS'},{airport_ident:'LOCAL',closed:'1',le_ident:'10',he_ident:'28'}],[{code:'GB',name:'United Kingdom'}]);
  assert.equal(data.length,1);assert.equal(data[0].country,'United Kingdom');assert.equal(data[0].elevationFt,null);assert.equal(data[0].runways.length,1);assert.equal(data[0].runways[0].ends,'09 / 27');assert.equal(data[0].runways[0].lengthFt,null);
});
test('search matches code prefixes, prioritises major airports, and does not match unrelated names',()=>{
  const data=[{icao:'EGLF',type:'medium_airport'},{icao:'EGLL',type:'large_airport'},{icao:'KJFK',name:'EGL',type:'large_airport'}];
  assert.deepEqual(searchAirports(data,'egl').map(a=>a.icao),['EGLL','EGLF']);assert.equal(searchAirports(data,'EGLL')[0].icao,'EGLL');assert.deepEqual(searchAirports(data,'ZZZZ'),[]);
});
test('running API provides worldwide airport and runway details, and handles invalid input',async()=>{
  const base='http://127.0.0.1:4317';
  const result=await fetch(base+'/api/airports?q=egl').then(r=>r.json());assert(result.data.every(a=>a.icao.startsWith('EGL')));assert(result.data.some(a=>a.icao==='EGLL'));assert(Number.isFinite(Date.parse(result.updatedAt)));
  for(const code of ['EGLL','KJFK','YSSY','RJTT','FAOR']){const response=await fetch(base+'/api/airports/'+code);assert.equal(response.status,200);const {data}=await response.json();assert.equal(data.icao,code);assert(data.name);assert(data.runways.length>0);}
  assert.equal((await fetch(base+'/api/airports?q=123')).status,400);assert.equal((await fetch(base+'/api/airports/ZZZZ')).status,404);assert.deepEqual((await fetch(base+'/api/airports?q=ZZZZ').then(r=>r.json())).data,[]);
});
