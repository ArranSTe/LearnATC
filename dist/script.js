const photos = [
  {url:'aircraft-1.jpg',author:'Matthew Sichkaruk',source:'https://unsplash.com/photos/silhouette-of-airplane-on-airport-during-sunset-QPWl9G53XYY'},
  {url:'aircraft-2.jpg',author:'Athena Sandrini',source:'https://www.pexels.com/photo/photo-of-airplane-flying-through-the-sky-2961993/'},
  {url:'aircraft-3.jpg',author:'ilya bashm',source:'https://unsplash.com/photos/airplane-on-runway-at-sunset-with-soft-sky-s4pC4b3j3r0'}
];
let current = 0;
let paused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let timer;
const slides = [...document.querySelectorAll('.photo')];
const dots = [...document.querySelectorAll('[data-slide]')];
const playback = document.querySelector('#playback');
function showSlide(index) {
  current = index;
  slides.forEach((slide,i)=>slide.classList.toggle('active',i===index));
  dots.forEach((dot,i)=>{dot.classList.toggle('selected',i===index);dot.setAttribute('aria-pressed',String(i===index));});
  document.querySelector('#current').textContent=String(index+1).padStart(2,'0');
  if(photos[index]) {document.querySelector('#credit').href=photos[index].source;document.querySelector('#credit').textContent=`Photo: ${photos[index].author} ↗`;}
}
function schedule(){clearInterval(timer);if(!paused&&!document.hidden)timer=setInterval(()=>showSlide((current+1)%slides.length),7000);}
function updatePlayback(){playback.setAttribute('aria-label',paused?'Play slideshow':'Pause slideshow');playback.innerHTML=paused?'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4l9 6-9 6z"/></svg>':'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5v10M13 5v10"/></svg>';schedule();}
photos.forEach((photo,i)=>{slides[i].style.backgroundImage=`url("${photo.url}")`;});
dots.forEach(dot=>dot.addEventListener('click',()=>{showSlide(Number(dot.dataset.slide));schedule();}));
playback.addEventListener('click',()=>{paused=!paused;updatePlayback();});
document.addEventListener('visibilitychange',schedule);
const dialog=document.querySelector('dialog');
document.querySelectorAll('[data-page]').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.page==='input'){window.location.href='input.html';return;}window.location.href='getting-started.html';return;document.querySelector('#dialog-title').textContent='Getting started.';document.querySelector('#dialog-copy').textContent='A short guide to using your VATSIM companion will be available here soon.';dialog.showModal();}));
document.querySelector('.close').addEventListener('click',()=>dialog.close());
document.querySelector('.back').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
showSlide(0);updatePlayback();

