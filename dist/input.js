const $ = id => document.getElementById(id);
const form = $('flight-form');
const fields = ['airline','flight-number','aircraft','gate'];
const selected = {departure:null,arrival:null};
const controllers = {};
const storageKey = 'vatsim-companion-flight-v1';
let restoring = false;
const number = value => value == null ? 'Not listed' : Math.round(value).toLocaleString('en-GB');
function el(tag,className,text) {const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=text;return node;}
function error(id,message='') {$(id+'-error').textContent=message;$(id).setAttribute('aria-invalid',String(Boolean(message)));}
function aircraftCode(){return $('aircraft').value==='OTHER'?$('custom-aircraft').value.trim():$('aircraft').value;}
function isAircraftValid(){return /^[A-Z0-9]{2,4}$/.test(aircraftCode());}
function updateSummary() {
  const airline=$('airline').value.trim(),flight=$('flight-number').value.trim();
  $('summary-callsign').textContent=airline+flight || '—';
  for(const kind of ['departure','arrival']) { $('summary-'+kind).textContent=selected[kind]?.icao || '····';$('summary-'+kind+'-city').textContent=selected[kind]?.city || (selected[kind]?.name ?? 'Not selected'); }
  $('summary-aircraft').textContent=aircraftCode() || 'Not selected';$('summary-gate').textContent=$('gate').value.trim() || '—';
  const count=[/^[A-Z]{3}$/.test(airline),/^[A-Z0-9]{1,4}$/.test(flight),!!selected.departure,!!selected.arrival,isAircraftValid(),!!$('gate').value.trim()].filter(Boolean).length;
  $('completion-count').textContent=`${count} / 6`;$('completion').value=count;
  if(!restoring){$('flight-badge').textContent='DRAFT';$('flight-badge').classList.remove('saved');$('save-status').textContent=count===6?'All details entered. Save your flight setup when ready.':'Complete your flight details to save your setup.';}
}
function emptyAirport(kind){const box=el('div','empty-airport');box.append(el('span','',kind==='departure'?'↗':'↘'),el('p','',`Your ${kind} airport`),el('small','','Select a match to see airport and runway details.'));$(kind+'-details').replaceChildren(box);}
function renderAirport(kind,airport) {
  const head=el('div','airport-card-head'),title=el('div','airport-title-row');
  title.append(el('span','airport-code',airport.icao),el('span','iata-code',airport.iata?`IATA ${airport.iata}`:''));
  head.append(title,el('h3','',airport.name),el('p','',[airport.city,airport.country].filter(Boolean).join(' · ')));
  const facts=el('div','airport-facts');facts.append(el('span','',`Elevation ${number(airport.elevationFt)}${airport.elevationFt==null?'':' ft'}`));
  if(airport.latitude!=null&&airport.longitude!=null) facts.append(el('span','',`${Math.abs(airport.latitude).toFixed(2)}°${airport.latitude<0?'S':'N'} ${Math.abs(airport.longitude).toFixed(2)}°${airport.longitude<0?'W':'E'}`));
  const runways=el('div','runways'),label=el('div','runway-heading');label.append(el('span','','RUNWAYS'),el('span','',String(airport.runways.length)));runways.append(label);
  if(!airport.runways.length)runways.append(el('p','no-runways','No runway information listed in the source.'));
  const surfaces={ASP:'Asphalt',CON:'Concrete',GRS:'Grass',TURF:'Turf',GRE:'Gravel',WATER:'Water',UNK:'Unknown'};
  for(const r of airport.runways){const row=el('div','runway-row');row.append(el('strong','',r.ends),el('span','',`${r.lengthFt==null?'Length not listed':number(r.lengthFt)+' ft'} · ${surfaces[r.surface] || r.surface}`));runways.append(row);}
  $(kind+'-details').replaceChildren(head,facts,runways);
}
function dataDate(response){$('data-date').textContent=`${response.stale?'Cached data':'Retrieved'} ${new Date(response.updatedAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}`;}
function airportSearch(kind) {
  const input=$(kind),list=$(kind+'-options'),help=$(kind+'-help');
  let results=[],active=-1,timer,request,version=0;
  function hide(){list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;}
  function cancel(){clearTimeout(timer);request?.abort();version++;hide();}
  function choose(airport){cancel();selected[kind]=airport;input.value=airport.icao;help.textContent='Airport selected';error(kind);renderAirport(kind,airport);updateSummary();}
  function highlight(index){active=index;[...list.children].forEach((option,i)=>option.setAttribute('aria-selected',String(i===index)));input.setAttribute('aria-activedescendant',`${kind}-option-${index}`);list.children[index]?.scrollIntoView({block:'nearest'});}
  async function search() {
    clearTimeout(timer);request?.abort();const stamp=++version,q=input.value.trim().toUpperCase();
    if(!/^[A-Z]{1,4}$/.test(q)){help.textContent='Start typing an ICAO code';hide();return;}
    help.textContent='Searching airports…';request=new AbortController();const timeout=setTimeout(()=>request?.abort(),12000);
    try {
      const response=await fetch(`/api/airports?q=${encodeURIComponent(q)}`,{signal:request.signal});
      const body=await response.json();if(!response.ok)throw new Error(body.error || 'Airport lookup is unavailable.');
      if(stamp!==version)return;
      dataDate(body);results=body.data;list.replaceChildren();active=-1;
      if(!results.length){help.textContent=`No airports match ${q}. Check the ICAO code and try again.`;hide();return;}
      help.textContent=results.length===8?'Showing 8 matches — keep typing to narrow the list':`${results.length} match${results.length===1?'':'es'} — choose an airport`;
      results.forEach((airport,index)=>{
        const option=el('div','option');option.id=`${kind}-option-${index}`;option.setAttribute('role','option');option.setAttribute('aria-selected','false');
        const header=el('div','option-header');header.append(el('strong','',airport.icao),el('span','',airport.name));
        option.append(header,el('small','',[airport.city,airport.country,airport.runways.length?`${airport.runways.length} runway${airport.runways.length===1?'':'s'} · ${airport.runways.map(r=>r.ends).join(', ')}`:'Runway details not listed'].filter(Boolean).join(' · ')));
        option.addEventListener('pointerdown',event=>event.preventDefault());option.addEventListener('click',()=>choose(airport));list.append(option);
      });
      if(document.activeElement===input){list.hidden=false;input.setAttribute('aria-expanded','true');}
    } catch (err) {if(stamp===version){help.textContent='Airport lookup unavailable. Re-enter the code or focus this field to retry.';hide();}}
    finally {clearTimeout(timeout);}
  }
  input.addEventListener('input',()=>{cancel();input.value=input.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,4);selected[kind]=null;emptyAirport(kind);error(kind);updateSummary();help.textContent=input.value?'Searching airports…':'Start typing an ICAO code';if(input.value)timer=setTimeout(search,180);});
  input.addEventListener('focus',()=>{if(input.value&&!selected[kind])search();});
  input.addEventListener('blur',()=>{cancel();});
  input.addEventListener('keydown',event=>{
    if(event.key==='Escape'){cancel();return;}
    if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();if(list.hidden){search();return;}highlight((active+(event.key==='ArrowDown'?1:-1)+results.length)%results.length);}
    if(event.key==='Enter'&&!list.hidden){event.preventDefault();if(active>=0)choose(results[active]);else if(results.length===1)choose(results[0]);else highlight(0);}
    if(event.key==='Tab')hide();
  });
  return {choose,cancel};
}
controllers.departure=airportSearch('departure');controllers.arrival=airportSearch('arrival');
for(const id of [...fields,'custom-aircraft']){
  $(id).addEventListener('input',()=>{
    if(['airline','custom-aircraft','flight-number'].includes(id))$(id).value=$(id).value.toUpperCase().replace(id==='airline'?/[^A-Z]/g:/[^A-Z0-9]/g,'');
    if(id==='gate')$(id).value=$(id).value.toUpperCase();
    if(id==='aircraft'){$('custom-aircraft-field').hidden=$('aircraft').value!=='OTHER';error('custom-aircraft');}
    error(id);updateSummary();
  });
}
form.addEventListener('submit',event=>{
  event.preventDefault();let first;
  function check(id,valid,message){error(id,valid?'':message);if(!valid&&!first)first=$(id);}
  check('airline',/^[A-Z]{3}$/.test($('airline').value),'Enter a three-letter airline ICAO code, such as BAW.');
  check('flight-number',/^[A-Z0-9]{1,4}$/.test($('flight-number').value),'Enter a flight number containing 1–4 letters or digits.');
  for(const kind of ['departure','arrival'])check(kind,selected[kind]?.icao===$(kind).value&&!!selected[kind],'Select an airport from the matching results.');
  check('aircraft',!!$('aircraft').value,'Select your aircraft.');
  if($('aircraft').value==='OTHER')check('custom-aircraft',isAircraftValid(),'Enter an aircraft ICAO type containing 2–4 letters or digits.');
  check('gate',!!$('gate').value.trim(),'Enter your departure gate or stand.');
  if(first){$('save-status').textContent='Check the highlighted fields before saving.';first.focus();return;}
  const flight={airline:$('airline').value,flightNumber:$('flight-number').value,departure:selected.departure.icao,arrival:selected.arrival.icao,aircraft:$('aircraft').value,customAircraft:$('custom-aircraft').value,gate:$('gate').value.trim(),departureAirport:selected.departure,arrivalAirport:selected.arrival,aircraftLabel:$('aircraft').value==='OTHER'?$('custom-aircraft').value:$('aircraft').selectedOptions[0].textContent.split(' · ').slice(1).join(' · ')};
  try {sessionStorage.setItem(storageKey,JSON.stringify(flight));window.location.href='radio.html';}
  catch {$('save-status').textContent='Your details are ready, but this browser could not save them. Keep this page open.';}
});
$('guide').addEventListener('click',()=>{window.location.href='getting-started.html';});$('close-guide').addEventListener('click',()=>$('guide-dialog').close());
async function restore(){
  let saved;try{saved=JSON.parse(sessionStorage.getItem(storageKey));}catch{}if(!saved)return;
  restoring=true;
  $('airline').value=String(saved.airline || '').slice(0,3);$('flight-number').value=String(saved.flightNumber || '').slice(0,4);$('gate').value=String(saved.gate || '').slice(0,15);$('aircraft').value=saved.aircraft || '';$('custom-aircraft').value=String(saved.customAircraft || '').slice(0,4);$('custom-aircraft-field').hidden=$('aircraft').value!=='OTHER';
  await Promise.all(['departure','arrival'].map(async kind=>{if(!/^[A-Z]{4}$/.test(saved[kind] || ''))return;$(kind).value=saved[kind];try{const response=await fetch(`/api/airports/${saved[kind]}`,{signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error();const body=await response.json();if($(kind).value===saved[kind]){controllers[kind].choose(body.data);dataDate(body);}}catch{$(kind+'-help').textContent='Could not reload airport data. Focus the field to retry.';}}));
  restoring=false;updateSummary();$('save-status').textContent='Your last saved flight details have been restored. Review and save any changes.';
}
updateSummary();restore();
