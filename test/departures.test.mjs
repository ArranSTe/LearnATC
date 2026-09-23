import test from 'node:test';
import assert from 'node:assert/strict';
import {getDepartures} from '../departure-data.mjs';
import {validFlight} from '../dist/radio-model.js';
test('flight suffix allows letters and digits but rejects punctuation and overlength callsigns',()=>{
 const flight={airline:'BAW',flightNumber:'24AB',departure:'EGLL',arrival:'EGKK',aircraft:'A320',gate:'A1'};
 assert(validFlight(flight));for(const value of ['','24-','12345'])assert(!validFlight({...flight,flightNumber:value}));
});
test('departure lookup keeps airport/runway filters through pagination and deduplicates',async()=>{
 const calls=[];const fetcher=async url=>{const q=new URL(url).searchParams;calls.push(q);return new Response(JSON.stringify({status:'success',data:[{airport:'EGLL',identifier:'TEST1A',type:{code:'SID'}},{airport:'OTHER',identifier:'WRONG',type:{code:'SID'}}],pagination:{has_more:q.get('page')==='1'}}),{headers:{'x-airac-cycle':'2609'}});};
 const result=await getDepartures('EGLL','27R',fetcher);assert.equal(calls.length,2);assert(calls.every(q=>q.get('runway')==='27R'&&q.get('airport')==='EGLL'));assert.deepEqual(result.data,[{identifier:'TEST1A'}]);assert.equal(result.cycle,'2609');
});
test('departure lookup distinguishes empty data from unavailable or malformed data',async()=>{
 assert.deepEqual((await getDepartures('EGLL','09L',async()=>new Response(JSON.stringify({status:'success',data:[]})))).data,[]);
 await assert.rejects(getDepartures('EGLL','09L',async()=>new Response('',{status:503})));
 await assert.rejects(getDepartures('EGLL','09L',async()=>new Response('{}')));
 await assert.rejects(getDepartures('EGLL','99',async()=>{throw new Error('Should not fetch');}));
});
