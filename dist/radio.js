import {alphabet,fields,steps,flightKey,validFlight,fieldError,atisReady,phraseParts} from './radio-model.js';
const $=id=>document.getElementById(id);
const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
let flight;try{flight=JSON.parse(sessionStorage.getItem('vatsim-companion-flight-v1'));}catch{}
if(!validFlight(flight)) $('missing-flight').hidden=false; else start();
function start(){
 $('radio-app').hidden=false;
 const key=flightKey(flight);let saved;try{saved=JSON.parse(sessionStorage.getItem('vatsim-radio-v1'));}catch{}
 const same=saved?.flightKey===key;
 let values=same&&saved.values&&typeof saved.values==='object'?saved.values:{};
 values=Object.fromEntries(Object.entries(values).filter(([k,v])=>fields[k]&&typeof v==='string').map(([k,v])=>[k,v.slice(0,100)]));
 const checked=same&&saved.checked&&typeof saved.checked==='object'?saved.checked:{};
 let index=same&&Number.isInteger(saved.index)?Math.max(0,Math.min(saved.index,steps.length-1)):0;
 if(!atisReady(values))index=0;
 const airports={departure:flight.departureAirport,arrival:flight.arrivalAirport};
 let sidRequest, sidVersion=0, sidState={runway:null,status:'idle',data:[]}, finishing=false;
 const callsign=flight.airline+flight.flightNumber;
 $('flight-title').textContent=callsign+' · Radio script';$('route').textContent=flight.departure+' → '+flight.arrival;
 function persist(){try{sessionStorage.setItem('vatsim-radio-v1',JSON.stringify({flightKey:key,index,values,checked}));$('save-status').textContent='Progress saved in this tab.';}catch{$('save-status').textContent='Unable to save progress. Keep this page open.';}}
 function resolved(){return {...Object.fromEntries(Object.entries(values).filter(([k,v])=>!fieldError(k,v))),callsign,stand:flight.gate,aircraft:flight.aircraftLabel||(flight.aircraft==='OTHER'?flight.customAircraft:flight.aircraft),destination:airports.arrival?.name||flight.arrival};}
 function cards(){
  const fragment=document.createDocumentFragment();
  steps[index].cards.forEach((c,i)=>{
   const card=make('article','card '+c.role),head=make('div','card-head');
   if(c.role==='pilot'){
    const check=make('input','say-check');check.type='checkbox';check.setAttribute('aria-label','Mark '+c.title+' as spoken');
    const id=steps[index].id+':'+i;check.checked=checked[id]===true;card.classList.toggle('spoken',check.checked);
    check.addEventListener('change',()=>{checked[id]=check.checked;card.classList.toggle('spoken',check.checked);persist();});head.append(check);
   }
   head.append(make('strong','',c.role==='atc'?'ATC example':c.role==='pilot'?'You say':'Remember'),make('span','',c.title));
   const p=make('p');let missing=false;
   for(const part of phraseParts(c.text,resolved())){if(part.missing){p.append(make('span','missing',part.text));missing=true;}else p.append(document.createTextNode(part.text));}
   card.append(head,p);if(missing)card.append(make('small','pending','Enter the missing details above.'));fragment.append(card);
  });$('cards').replaceChildren(fragment);
 }
 function navigate(next){if(next>0&&!atisReady(values)){index=0;render();$('stage-error').textContent='Enter the ATIS information and a valid QNH before continuing.';$(values.info?'qnh':'info').focus();return;}index=next;persist();render();$('stage-title').focus();}
 function runwayOptions(kind){return [...new Set((airports[kind]?.runways||[]).flatMap(r=>r.ends.split(' / ')).filter(r=>/^(0[1-9]|[12]\d|3[0-6])[LRC]?$/.test(r)))].sort();}
 function populateRunway(input,k){const ends=runwayOptions(fields[k].airport);input.replaceChildren(new Option(ends.length?'Select runway…':'Runway data unavailable',''));ends.forEach(end=>input.append(new Option(end,end)));input.disabled=!ends.length;input.value=ends.includes(values[k])?values[k]:'';}
 function updateValue(k,value){const previous=values[k];values[k]=value.trim();if(previous!==values[k]){for(const step of steps)step.cards.forEach((c,i)=>{if(c.text.includes('{{'+k+'}}'))delete checked[step.id+':'+i];});}persist();cards();}
 function sidOptions(){
  const input=$('sid');if(!input)return;
  const manual=$('sid-manual'),help=$('sid-help');
  let prompt=!values.departureRunway?'Select a departure runway first':sidState.status==='loading'?'Loading departures…':sidState.status==='error'?'Departure lookup unavailable':sidState.data.length?'Select assigned departure…':'No departures listed for this runway';
  input.replaceChildren(new Option(prompt,''));
  sidState.data.forEach(s=>input.append(new Option(s.identifier,s.identifier)));
  input.append(new Option('Other / enter assigned departure','__manual'));
  input.disabled=!values.departureRunway;
  const isManual=!!values.sid&&!sidState.data.some(s=>s.identifier===values.sid);
  input.value=isManual?'__manual':values.sid||'';manual.hidden=!isManual;manual.value=isManual?values.sid:'';
  help.textContent=sidState.status==='error'?'Try again, or enter the departure assigned by ATC.':sidState.status==='ready'?`From AIRAC API${sidState.cycle?' · cycle '+sidState.cycle:''}. Choose only the departure assigned by ATC.`:'Choose your runway to look up departures.';
  $('sid-retry').hidden=sidState.status!=='error';
 }
 async function loadSids(force=false){
  const runway=values.departureRunway||'';
  if(!force&&sidState.runway===runway)return;
  sidRequest?.abort();const version=++sidVersion;
  sidState={runway,status:runway?'loading':'idle',data:[]};sidOptions();if(!runway)return;
  sidRequest=new AbortController();const timeout=setTimeout(()=>sidRequest.abort(),12000);
  try{const r=await fetch(`/api/departures?airport=${flight.departure}&runway=${encodeURIComponent(runway)}`,{signal:sidRequest.signal});if(!r.ok)throw new Error();const body=await r.json();if(version!==sidVersion)return;sidState={runway,status:'ready',data:body.data,cycle:body.cycle};}
  catch{if(version!==sidVersion)return;sidState={runway,status:'error',data:[]};}
  finally{clearTimeout(timeout);if(version===sidVersion)sidOptions();}
 }
 function render(){
  const step=steps[index];$('phase').textContent=step.phase+' · Step '+(index+1)+' of '+steps.length;$('stage-title').textContent=step.title;$('description').textContent=step.description;$('stage-error').textContent='';
  $('steps').replaceChildren();steps.forEach((s,i)=>{const b=make('button','',s.name);b.type='button';if(i===index)b.setAttribute('aria-current','step');b.title=s.phase;b.addEventListener('click',()=>navigate(i));$('steps').append(b);});
  const current=$('steps').querySelector('[aria-current]');$('steps').scrollLeft=current.offsetLeft-$('steps').offsetLeft-10;
  $('fields').replaceChildren();
  for(const k of step.fields){
   const f=fields[k],wrap=make('div'),label=make('label','',f.label);label.htmlFor=k;let input;
   if(f.type==='info'){input=make('select');input.append(new Option('Select information…',''));alphabet.forEach((word,i)=>input.append(new Option(String.fromCharCode(65+i)+' — '+word,word)));}
   else if(f.type==='runway'){input=make('select');populateRunway(input,k);}
   else if(k==='sid'){input=make('select');}
   else{input=make('input');input.type='text';input.placeholder=f.placeholder||'';input.maxLength=['qnh','squawk'].includes(f.type)?4:80;if(['qnh','squawk'].includes(f.type))input.inputMode='numeric';}
   input.id=k;if(f.type!=='runway')input.value=values[k]||'';input.autocomplete='off';input.setAttribute('aria-describedby',k==='sid'?'sid-help':k+'-error');
   const error=make('p','field-error',fieldError(k,input.value));error.id=k+'-error';
   input.addEventListener(input.tagName==='SELECT'?'change':'input',()=>{
    if(k==='sid'&&input.value==='__manual'){$('sid-manual').hidden=false;$('sid-manual').value='';updateValue(k,'');$('sid-manual').focus();return;}
    let value=input.value;if(['runway','squawk'].includes(f.type))value=value.toUpperCase();
    updateValue(k,value);error.textContent=fieldError(k,values[k]);input.setAttribute('aria-invalid',String(!!error.textContent));$('stage-error').textContent='';
    if(k==='departureRunway'){updateValue('sid','');loadSids(true);}
    if(k==='sid')$('sid-manual').hidden=true;
   });wrap.append(label,input,error);
   if(k==='sid'){
    const manual=make('input');manual.id='sid-manual';manual.hidden=true;manual.maxLength=80;manual.placeholder='Departure assigned by ATC';manual.setAttribute('aria-label','Manually enter assigned departure');manual.addEventListener('input',()=>updateValue('sid',manual.value.toUpperCase()));
    const help=make('p','field-help');help.id='sid-help';help.setAttribute('role','status');
    const retry=make('button','sid-retry','Retry departures');retry.id='sid-retry';retry.type='button';retry.hidden=true;retry.addEventListener('click',()=>loadSids(true));wrap.append(manual,help,retry);
   }
   if(f.type==='runway'&&!runwayOptions(f.airport).length)wrap.append(make('p','field-help','Runway information is unavailable for this airport. Reload to retry.'));
   $('fields').append(wrap);
  }
  sidOptions();loadSids();cards();$('previous').disabled=index===0;$('next').textContent=index===steps.length-1?'Finish flight ✓':'Next →';$('count').textContent=`${index+1} / ${steps.length}`;
 }
 function finish(){
  if(finishing)return;finishing=true;persist();const dialog=make('dialog','celebration');dialog.setAttribute('aria-labelledby','well-done');
  const title=make('h2','','Well done!');title.id='well-done';dialog.append(make('div','celebration-icon','✓'),title,make('p','','Flight complete. Taking you home in a moment…'));
  const home=make('a','primary','Back home');home.href='index.html';dialog.append(home);document.body.append(dialog);
  if(window.learnATCSettings?.celebrations!==false&&!matchMedia('(prefers-reduced-motion: reduce)').matches){const confetti=make('div','confetti');confetti.setAttribute('aria-hidden','true');for(let i=0;i<60;i++){const bit=make('i');bit.style.cssText=`left:${Math.random()*100}%;background:hsl(${Math.random()*360} 80% 60%);animation-delay:${Math.random()*0.7}s;transform:rotate(${Math.random()*360}deg)`;confetti.append(bit);}dialog.append(confetti);}
  dialog.showModal();setTimeout(()=>{window.location.href='index.html';},3500);
 }
 $('previous').addEventListener('click',()=>{if(index>0)navigate(index-1);});$('next').addEventListener('click',()=>index<steps.length-1?navigate(index+1):finish());
 render();
 for(const kind of ['departure','arrival']) fetch('/api/airports/'+flight[kind],{signal:AbortSignal.timeout(12000)}).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(body=>{
  airports[kind]=body.data;const k=kind+'Runway';if(values[k]&&!runwayOptions(kind).includes(values[k])){updateValue(k,'');if(kind==='departure'){updateValue('sid','');loadSids(true);}}
  if($(k))populateRunway($(k),k);cards();
 }).catch(()=>{if(!airports[kind])$('save-status').textContent='Airport runway information unavailable. Reload to retry.';});
}
