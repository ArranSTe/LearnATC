(() => {
 const defaults={largeText:false,showExamples:false,celebrations:true};
 let settings={...defaults};try{const saved=JSON.parse(localStorage.getItem('learnatc-settings-v1'));for(const key of Object.keys(defaults))if(typeof saved?.[key]==='boolean')settings[key]=saved[key];}catch{}
 function apply(){window.learnATCSettings=settings;document.documentElement.classList.toggle('large-script',settings.largeText);document.documentElement.classList.toggle('hide-examples',!settings.showExamples);}
 apply();
 const gear=document.createElement('a');gear.className='settings-gear';gear.href='settings.html';gear.setAttribute('aria-label','Settings');gear.title='Settings';gear.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 2 3-1 2 2 3-1 1-3 3-1 1-3-2-2 1-3-3-2-3 1-2-1Z"/><circle cx="11" cy="10.5" r="3"/></svg>';document.body.append(gear);
 const form=document.getElementById('settings-form');if(!form)return;
 for(const key of Object.keys(defaults)){const input=document.getElementById(key);input.checked=settings[key];input.addEventListener('change',()=>{settings[key]=input.checked;apply();try{localStorage.setItem('learnatc-settings-v1',JSON.stringify(settings));document.getElementById('settings-status').textContent='Settings saved.';}catch{document.getElementById('settings-status').textContent='Settings apply now, but could not be saved in this browser.';}});}
})();
