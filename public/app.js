async function fetchWishes(){
  const res = await fetch('/api/wishes');
  if(!res.ok) return [];
  return res.json();
}

function el(tag, cls, text){ const e = document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e }

function renderWishes(list){
  const container = document.getElementById('wishes');
  container.innerHTML='';
  if(list.length===0){ container.appendChild(el('div','card','ยังไม่มีคำอวยพร — เป็นคนแรกที่ส่งได้เลย!')); return }
  list.forEach(w=>{
    const card = el('div','wish');
    const meta = el('div','meta');
    meta.appendChild(el('div','name',w.name));
    const t = new Date(w.time);
    meta.appendChild(el('div','time',t.toLocaleString()));
    card.appendChild(meta);
    const msg = el('div','message'); msg.textContent = w.message;
    card.appendChild(msg);
    container.appendChild(card);
  })
}

async function loadAndRender(){
  const data = await fetchWishes();
  renderWishes(data);
}

// track displayed ids to avoid duplicates when receiving SSE
const displayedIds = new Set();

function addWishToDOM(w){
  if(displayedIds.has(w.id)) return;
  displayedIds.add(w.id);
  const container = document.getElementById('wishes');
  const card = el('div','wish');
  const meta = el('div','meta');
  meta.appendChild(el('div','name',w.name));
  const t = new Date(w.time);
  meta.appendChild(el('div','time',t.toLocaleString()));
  card.appendChild(meta);
  const msg = el('div','message'); msg.textContent = w.message;
  card.appendChild(msg);
  // insert at top
  container.insertBefore(card, container.firstChild);
}

document.getElementById('wishForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  const message = document.getElementById('message').value.trim();
  if(!name || !message) return;
  const btn = e.target.querySelector('button');
  btn.disabled = true; btn.textContent = 'กำลังส่ง...';
  try{
    const res = await fetch('/api/wishes', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,message})});
    if(!res.ok){ alert('เกิดข้อผิดพลาดในการส่ง'); }
    else{
      const created = await res.json();
      document.getElementById('name').value='';
      document.getElementById('message').value='';
      // update UI immediately using returned object
      addWishToDOM(created);
      try{ triggerFireworks(); }catch(e){ /* ignore */ }
    }
  }catch(err){ alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์'); }
  btn.disabled = false; btn.textContent = 'ส่งคำอวยพร';
});

// initial load
loadAndRender().then(list=>{
  list.forEach(w=> displayedIds.add(w.id));
});

// SSE real-time updates
if (!!window.EventSource) {
  const es = new EventSource('/api/stream');
  es.onmessage = e => {
    try{
      const data = JSON.parse(e.data);
      addWishToDOM(data);
      try{ triggerFireworks(); }catch(e){}
    }catch(err){ /* ignore malformed */ }
  };
  es.onerror = ()=>{
    // connection issues are silent; browser will retry
  };
}

/* Fireworks animation */
const canvas = document.getElementById('fireworks');
const ctx = canvas.getContext && canvas.getContext('2d');
let W=0,H=0,particles=[];
function resize(){ W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight }
window.addEventListener('resize', resize); resize();

function random(min,max){ return Math.random()*(max-min)+min }

function launch(x,y, hue){
  const baseHue = (typeof hue === 'number') ? hue : Math.floor(random(0,360));
  const count = 80;
  for(let i=0;i<count;i++){
    particles.push({
      x:x, y:y,
      vx: Math.cos(Math.PI*2*i/count)*random(1,6)*random(0.5,1.5),
      vy: Math.sin(Math.PI*2*i/count)*random(1,6)*random(0.5,1.5),
      life: random(60,110),
      age:0,
      size: random(1,3),
      hue: baseHue + random(-40,40)
    });
  }
}

function singleRandomFirework(){
  const x = random(W*0.1, W*0.9);
  const y = random(H*0.12, H*0.5);
  const hue = Math.floor(random(0,360));
  launch(x,y,hue);
  // small secondary bursts
  setTimeout(()=>launch(x + random(-80,80), y + random(-40,40), (hue+40)%360), 120);
}

function triggerFireworks(){
  // multiple bursts at random positions near top-center
  const cx = W/2; const top = H*0.25;
  launch(cx, top);
  setTimeout(()=>launch(cx - 120, top + 60), 150);
  setTimeout(()=>launch(cx + 120, top + 30), 300);
}

// manual fire button hookup
const manualBtn = document.getElementById('manualFire');
if(manualBtn){
  manualBtn.addEventListener('click', ()=>{
    try{ ensureAudio(); singleRandomFirework(); playFireworkSound(); }catch(e){}
  });
}

// Audio: simple synthesized firework sound using Web Audio API
let audioCtx = null;
function ensureAudio(){
  if(audioCtx) return;
  try{
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }catch(e){ audioCtx = null }
}

function playFireworkSound(){
  if(!audioCtx) return;
  const now = audioCtx.currentTime;
  // burst: filtered noise for sizzle
  const bufferSize = audioCtx.sampleRate * 1.0;
  const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for(let i=0;i<bufferSize;i++) data[i] = (Math.random()*2-1) * Math.exp(-i/bufferSize*4);
  const noise = audioCtx.createBufferSource();
  noise.buffer = noiseBuffer;
  const noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.8, now + 0.002);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
  const band = audioCtx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.setValueAtTime(1200 + Math.random()*2400, now);
  band.Q.setValueAtTime(1 + Math.random()*6, now);
  const master = audioCtx.createGain(); master.gain.value = 0.8;
  noise.connect(band); band.connect(noiseGain); noiseGain.connect(master); master.connect(audioCtx.destination);
  noise.start(now); noise.stop(now + 1);

  // boom: low sine with quick attack
  const osc = audioCtx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(60, now);
  osc.frequency.exponentialRampToValueAtTime(30, now + 0.7);
  const og = audioCtx.createGain(); og.gain.setValueAtTime(0.0001, now);
  og.gain.exponentialRampToValueAtTime(0.6, now + 0.01);
  og.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
  osc.connect(og); og.connect(audioCtx.destination);
  osc.start(now); osc.stop(now + 0.9);
}

// ensure audio is resumed when user interacts with the page (some browsers require gesture)
document.addEventListener('click', ()=>{ if(audioCtx && audioCtx.state==='suspended') audioCtx.resume(); }, { once:false });

function step(){
  if(!ctx) return;
  ctx.clearRect(0,0,W,H);
  for(let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    p.vy += 0.05; // gravity
    p.x += p.vx; p.y += p.vy; p.age++;
    const alpha = Math.max(0,1 - p.age / p.life);
    ctx.beginPath();
    ctx.fillStyle = `hsla(${p.hue},90%,60%,${alpha})`;
    ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
    ctx.fill();
    if(p.age>p.life){ particles.splice(i,1) }
  }
  requestAnimationFrame(step);
}
requestAnimationFrame(step);
