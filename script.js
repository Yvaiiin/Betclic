// ---------- Slot Betclic — build stable ----------

// ========== CONFIG ==========
const TOTAL_CREDITS = 15;
const TOTAL_SPINS   = 15;
const TOTAL_WINS    = 10;               // 10 gagnants sur les 14 premiers
const JACKPOT_SPIN  = 15;               // JACKPOT au 15e
const JACKPOT_SYMBOL = "\u{1F171}\uFE0F"; // 🅱️
const FRUITS = ["🍒","🍋","🍇","🍉","🍊","🍓","🍎","🍍","🥝","🍑"];
const FILL   = ["💰","⭐️","♥️","🍀","💎"];

// === Easter Egg : triple-clic ou tap sur le logo "B" pour ouvrir LinkedIn ===
document.addEventListener("DOMContentLoaded", () => {
  const logo = document.querySelector(".brand-logo");
  if (!logo) return;

  const profileURL = "https://www.linkedin.com/in/yvainramousse/"; // 🔗 ton vrai lien ici
  const maxDelay = 2000; // 2 secondes pour les 3 clics
  let clicks = [];

  function detectTripleClick() {
    const now = Date.now();
    clicks = clicks.filter(t => now - t < maxDelay);
    clicks.push(now);
    if (clicks.length >= 3) {
      clicks = [];
      window.open(profileURL, "_blank");
    }
  }

  logo.addEventListener("click", detectTripleClick);
  logo.addEventListener("touchstart", detectTripleClick, { passive: true });
});


// ===== DOM (avec garde-fous) =====
const spinBtn    = document.querySelector(".btn.btn-primary");
const resetBtn   = document.querySelector(".btn.btn-ghost");
const reels      = Array.from(document.querySelectorAll(".reel .symbol"));
const creditPill = document.querySelector(".status .pill"); // 1re pill
const skillsEls  = Array.from(document.querySelectorAll(".skills-grid .skill"));
const slotWindow = document.querySelector(".slot-window");
if (!spinBtn || !resetBtn || reels.length !== 4) {
  console.warn("[slot] DOM incomplet. Vérifie .btn-primary, .btn-ghost et 4 x .reel .symbol");
}

// ========== AUDIO (WebAudio réactif) ==========
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioCtx({ latencyHint: "interactive" });
let audioPrimed = false;
function primeAudio() {
  if (audioPrimed) return;
  audioPrimed = true;
  audioCtx.resume().catch(()=>{});
  try {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    g.gain.value = 0.0001;
    o.connect(g).connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + 0.01);
  } catch {}
}
window.addEventListener("pointerdown", primeAudio, { once: true, passive: true });

let spinTickTimer = null;
function clickNoise(duration=18, vol=0.22){
  const buf = audioCtx.createScriptProcessor(256,1,1);
  const v = audioCtx.createGain(); v.gain.value = vol;
  buf.onaudioprocess = e => {
    const ch = e.outputBuffer.getChannelData(0);
    for (let i=0;i<ch.length;i++) ch[i] = (Math.random()*2-1)*0.6;
  };
  const g = audioCtx.createGain();
  const now = audioCtx.currentTime;
  g.gain.setValueAtTime(0.001, now);
  g.gain.exponentialRampToValueAtTime(1, now + 0.004);
  g.gain.exponentialRampToValueAtTime(0.001, now + duration/1000);
  buf.connect(g).connect(v).connect(audioCtx.destination);
  setTimeout(() => buf.disconnect(), duration);
}
function beep(freq=700, dur=0.1, vol=0.15, type="square"){
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type; o.frequency.value = freq;
  const now = audioCtx.currentTime;
  g.gain.setValueAtTime(vol, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.connect(g).connect(audioCtx.destination);
  o.start(); o.stop(now + dur);
}
const SFX = {
  spinStart(){
    if (audioCtx.state === "suspended") audioCtx.resume();
    beep(680, 0.09, 0.12, "square");
    clearInterval(spinTickTimer);
    spinTickTimer = setInterval(() => clickNoise(16, 0.20), 70);
  },
  stop(){
    clearInterval(spinTickTimer);
    // petit drop
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "triangle";
    const now = audioCtx.currentTime;
    o.frequency.setValueAtTime(520, now);
    o.frequency.exponentialRampToValueAtTime(180, now + 0.18);
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    o.connect(g).connect(audioCtx.destination);
    o.start(); o.stop(now + 0.22);
  },
  win(){
    clearInterval(spinTickTimer);
    [620,780,980,1240,1560].forEach((f,i)=>setTimeout(()=>beep(f,0.11,0.18,"square"), i*80));
  }
};

// Démarrage immédiat du SFX au down (pas d’attente du click)
spinBtn?.addEventListener("pointerdown", () => SFX.spinStart(), { passive: true });

// ========== ÉTAT ==========
let credits = TOTAL_CREDITS;
let spins   = 0;
let isSpinning = false;
let obtained = 0; // nb de compétences gagnées

// Tirage des 10 spins gagnants parmi 1..14 (le 15 est le JACKPOT)
const winSpins = new Set();
while (winSpins.size < TOTAL_WINS) {
  winSpins.add(Math.floor(Math.random() * (JACKPOT_SPIN - 1)) + 1); // 1..14
}

// ========== UI helpers ==========
function updateCreditsUI(){
  if (!creditPill) return;
  creditPill.innerHTML = `Crédits 💰 : <strong>${credits}</strong> / ${TOTAL_CREDITS}`;
}
function setReelsTo(arr){ reels.forEach((el,i)=> el.textContent = arr[i] ?? FRUITS[i % FRUITS.length]); }
function shuffleTick(){
  reels.forEach((el,i)=>{
    const pool = [...FRUITS, ...FILL];
    el.textContent = pool[(Math.random()*pool.length)|0];
  });
}
function unlockNextSkill(){
  if (obtained >= skillsEls.length) return;
  const el = skillsEls[obtained];
  if (el && !el.classList.contains("won")) {
    el.classList.add("won");
    obtained++;
    slotWindow?.classList.add("flash-win");
    setTimeout(() => slotWindow?.classList.remove("flash-win"), 900);
  }
}

// ========== CONFETTIS (pluie pleine page 3s) ==========
let confettiRAF=null, confettiCanvas=null, cctx=null, particles=[];
function startConfettiRain(){
  confettiCanvas = document.createElement("canvas");
  confettiCanvas.style.position="fixed";
  confettiCanvas.style.inset="0";
  confettiCanvas.style.zIndex="999";
  confettiCanvas.style.pointerEvents="none";
  document.body.appendChild(confettiCanvas);
  cctx = confettiCanvas.getContext("2d");
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  const colors = ["#ffd044","#ff2d3e","#ffffff","#b58b00"];
  particles = Array.from({length:380}, ()=>({
    x: Math.random()*confettiCanvas.width,
    y: Math.random()*confettiCanvas.height - confettiCanvas.height,
    r: 2 + Math.random()*6,
    vy: 2 + Math.random()*4+2,
    vx: (Math.random()-0.5)*2,
    tilt: Math.random()*6,
    rot: Math.random()*Math.PI,
    color: colors[(Math.random()*colors.length)|0],
  }));
  const step = ()=>{
    cctx.clearRect(0,0,confettiCanvas.width, confettiCanvas.height);
    particles.forEach(p=>{
      p.y += p.vy; p.x += p.vx; p.tilt += 0.12; p.rot += 0.03;
      if (p.y > confettiCanvas.height) { p.y = -10; p.x = Math.random()*confettiCanvas.width; }
      cctx.save();
      cctx.translate(p.x, p.y);
      cctx.rotate(p.rot);
      cctx.fillStyle = p.color;
      cctx.fillRect(-p.r, -p.r, p.r*2, p.r*2);
      cctx.restore();
    });
    confettiRAF = requestAnimationFrame(step);
  };
  step();
}
function stopConfettiRain(){
  if (confettiRAF) cancelAnimationFrame(confettiRAF);
  window.removeEventListener("resize", resizeCanvas);
  particles=[]; if (confettiCanvas) confettiCanvas.remove();
  confettiRAF = null; confettiCanvas = null; cctx = null;
}
function resizeCanvas(){
  if (!confettiCanvas) return;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  confettiCanvas.width  = Math.floor(innerWidth * dpr);
  confettiCanvas.height = Math.floor(innerHeight * dpr);
  confettiCanvas.style.width  = innerWidth + "px";
  confettiCanvas.style.height = innerHeight + "px";
  if (cctx) cctx.setTransform(1,0,0,1,0,0);
}

// ========== MODAL JACKPOT ==========
function showJackpotPopup(){
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-panel">
      <h2>🎉 JACKPOT 🎉</h2>
      <p>C’est vraiment votre jour de chance 😉 Découvrez votre lot !</p>
      <a class="modal-cta" target="_blank"
         href="https://drive.google.com/drive/folders/1wa0lKW5vIdgNRmOAg-iAW3QiZ8ZG5NCE?usp=sharing">
         Télécharger
      </a>
      <button class="modal-close">Fermer</button>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector(".modal-close").addEventListener("click", ()=> modal.remove());
}

// ========== LOGIQUE SPIN ==========
spinBtn?.addEventListener("click", onSpin);
resetBtn?.addEventListener("click", onReset);
spinBtn?.removeAttribute("disabled");
resetBtn?.removeAttribute("disabled");
updateCreditsUI();
setReelsTo(["🍒","🍋","🍇","🔔"]);

function onSpin(){
  if (isSpinning || credits<=0) return;
  isSpinning = true;
  credits--; spins++; updateCreditsUI();

  // Animation de rotation ~1s
  const anim = setInterval(shuffleTick, 55);
  setTimeout(()=> {
    clearInterval(anim);

    // JACKPOT au 15e
    if (spins === JACKPOT_SPIN){
      reels.forEach(el=> el.textContent = JACKPOT_SYMBOL); // 🅱️🅱️🅱️🅱️
      SFX.win();
      // Confettis 3s, puis popup
      startConfettiRain();
      setTimeout(()=>{
        stopConfettiRain();
        showJackpotPopup();
      }, 3000);
      isSpinning = false;
      return;
    }

    // GAGNANT si spin ∈ set (et pas plus de 10 gains)
    if (winSpins.has(spins) && obtained < TOTAL_WINS){
      const fruit = FRUITS[(Math.random()*FRUITS.length)|0];
      setReelsTo([fruit, fruit, fruit, fruit]);   // 4x le même fruit
      unlockNextSkill();                          // débloque la compétence suivante
    } else {
      // NON-gagnant → s'assurer de ne pas faire 4 identiques
      const pool = [...FRUITS, ...FILL];
      const a = pool[(Math.random()*pool.length)|0];
      let b = pool[(Math.random()*pool.length)|0]; while (b===a) b = pool[(Math.random()*pool.length)|0];
      const c = pool[(Math.random()*pool.length)|0];
      const d = pool[(Math.random()*pool.length)|0];
      setReelsTo([a,b,c,d]);
    }

    SFX.stop();
    isSpinning = false;
  }, 1000);
}

function onReset(){
  if (isSpinning) return;
  credits = TOTAL_CREDITS; spins = 0; obtained = 0;
  updateCreditsUI();
  skillsEls.forEach(el=> el.classList.remove("won"));
  setReelsTo(["🍒","🍋","🍇","🔔"]);
}
