/**
 * alive-backend.js — the "alive" entity renderer behind <rabble-entity backend="alive">
 *
 * Source: Mark's hand-built entity, "RaBbLE · The Entity (alive).html" (S233 intake,
 * RaBbLE-BaBbLE/reliquary/2026-09-26-entity-harness/). Its render/animation code is kept
 * verbatim inside createAlive() so the look stays identical; what changed around it:
 *   - DOM is created inside the host and scoped (no document ids), CSS injected once
 *   - colors come from Aether tokens at mount (readPalette); off-palette hexes swapped per
 *     RaBbLE-Grimoire/RaBbLE-Agent/RaBbLE-Palette-Candidates.md (D4, S234)
 *   - boot is driven by the host: boot({steps}) runs the choreography and HOLDS at the
 *     ready phase until the host settles each step (masks a cold backend)
 *   - three layers of behaviour: state (idle|listening|speaking, Aether portal flip),
 *     mood (idle|ponder|process|insight|curious, the SVG rig's state machine) and
 *     emotion (calm|joy|sad|angry, the alive body/aura styles)
 *   - 3D uses NeBuLA's single Three.js (utils/three-loader.js, 0.160) + vendored fat lines,
 *     color management off to keep the r128 additive look
 *   - pause/resume/dispose, events on the host element
 * Plan: RaBbLE-Grimoire/log/plans/EP1-Entity-Face-Plan.md (W1). API: RaBbLE-Grimoire/RaBbLE-NeBuLA/RaBbLE-NeBuLA-API.md
 */
import { ensureThree, hasWebGL } from '../utils/three-loader.js';
import { installFatLines } from '../utils/three-fatlines.js';
import { readPalette } from '../puppet/palette.js';
import { version as VERSION } from '../version.js';

const STYLE_ID = 'rbl-alive-style';
// Colors are Aether tokens only; fallbacks are the canonical Palette.md values.
const CSS = `
.rbl-alive{position:absolute;inset:0;overflow:hidden;background:var(--rabble-bg,#0a0010);color:var(--rabble-text,#e8e6f0);
  -webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
.rbl-alive canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
.rbl-alive .rbl-fx{position:absolute;inset:0;pointer-events:none}
.rbl-alive .rbl-scan{background:repeating-linear-gradient(to bottom,rgba(0,0,0,.05) 0 1px,transparent 1px 3px)}
.rbl-alive .rbl-vig{background:radial-gradient(ellipse at center,transparent 52%,color-mix(in srgb,var(--rabble-bg,#0a0010) 82%,transparent) 100%)}
.rbl-alive .rbl-chroma{background:linear-gradient(to bottom,color-mix(in srgb,var(--rabble-magenta,#ff2d78) 1.5%,transparent),transparent 30%,transparent 70%,color-mix(in srgb,var(--rabble-cyan,#00f5ff) 1.5%,transparent))}
.rbl-alive .rbl-bootui{position:absolute;pointer-events:none;display:flex;flex-direction:column;gap:10px;opacity:0;transition:opacity .9s ease}
.rbl-alive .rbl-wordmark{font-family:var(--rabble-font-hero,"Orbitron","Exo 2",sans-serif);font-weight:900;letter-spacing:.14em;line-height:1;
  background:linear-gradient(90deg,var(--rabble-magenta,#ff2d78),var(--rabble-violet,#bf5fff),var(--rabble-cyan,#00f5ff),var(--rabble-violet,#bf5fff),var(--rabble-magenta,#ff2d78));background-size:300% 100%;
  -webkit-background-clip:text;background-clip:text;color:transparent;animation:rbl-wm 4s linear infinite;
  filter:drop-shadow(0 0 14px color-mix(in srgb,var(--rabble-magenta,#ff2d78) 35%,transparent));opacity:0;transition:opacity 1s}
@keyframes rbl-wm{to{background-position:300% 0}}
.rbl-alive .rbl-tagline{font-family:var(--rabble-font-ui,"Exo 2",sans-serif);color:var(--rabble-violet,#bf5fff);letter-spacing:.22em;text-transform:uppercase;opacity:0;transition:opacity 1s}
.rbl-alive .rbl-log{font-family:var(--rabble-font-mono,"Share Tech Mono",ui-monospace,monospace);color:var(--rabble-muted,#6b6880);position:relative;overflow:hidden;width:100%}
.rbl-alive .rbl-log .ln{position:absolute;left:0;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis;transition:transform .35s ease,opacity .35s ease}
.rbl-alive .rbl-log .ts{color:var(--rabble-border,#2a2840)}
.rbl-alive .rbl-log .okb{color:var(--rabble-text,#e8e6f0)}
.rbl-alive .rbl-log .ok{color:var(--rabble-cyan,#00f5ff);text-shadow:0 0 8px color-mix(in srgb,var(--rabble-cyan,#00f5ff) 60%,transparent)}
.rbl-alive .rbl-log .fail{color:var(--rabble-red,#e05c6f)}
.rbl-alive .rbl-log .sub{color:var(--rabble-violet,#bf5fff)}
.rbl-alive .rbl-log .msg{color:var(--rabble-muted,#6b6880)}
.rbl-alive .rbl-log .hi{color:var(--rabble-magenta,#ff2d78)}
.rbl-alive .rbl-log .rdy{color:var(--rabble-text,#e8e6f0)}
.rbl-alive .rbl-bar{height:3px;background:var(--rabble-border,#2a2840);border-radius:2px;overflow:hidden}
.rbl-alive .rbl-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--rabble-cyan,#00f5ff),var(--rabble-violet,#bf5fff),var(--rabble-magenta,#ff2d78));box-shadow:0 0 12px var(--rabble-magenta,#ff2d78)}
.rbl-alive .rbl-pct{font-family:var(--rabble-font-mono,"Share Tech Mono",monospace);color:var(--rabble-muted,#6b6880);font-size:12px;letter-spacing:.1em;text-transform:uppercase}
.rbl-alive .rbl-pct b{color:var(--rabble-cyan,#00f5ff);font-weight:400}
`;
function injectStyle() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = CSS;
  document.head.appendChild(s);
}

export const ALIVE_STATES   = ['idle', 'listening', 'speaking'];
export const ALIVE_MOODS    = ['idle', 'ponder', 'process', 'insight', 'curious'];
export const ALIVE_EMOTIONS = ['calm', 'joy', 'sad', 'angry'];

/**
 * Mount the alive entity inside `host` (which must have a size; the stage fills it).
 *
 * @param {HTMLElement} host
 * @param {Object} [opts]
 * @param {boolean} [opts.autoboot=false]     boot immediately with no host steps
 * @param {boolean} [opts.autonomous=true]    moods + emotions wander on their own
 * @param {'2d'|'3d'} [opts.dimension='2d']   3D switches on after boot (WebGL + Three.js)
 * @param {boolean} [opts.interactive=true]   pointer gaze / pokes
 * @param {boolean} [opts.trackWindow=true]   read the pointer from the window (UI may cover the canvas)
 * @param {boolean} [opts.holdToListen=false] press-and-hold the canvas enters `listening`
 * @param {boolean} [opts.skippable=true]     tap during boot fast-forwards (never past a pending hold)
 * @param {number}  [opts.stepTimeout=45]     seconds before pending boot steps auto-fail (0 = never)
 * @param {string}  [opts.tagline]            boot tagline text
 * @param {string}  [opts.readyLine]          final boot log line
 * @param {string}  [opts.portalA] [opts.portalB]  palette names for the two poles (default cyan / magenta)
 * @returns {Object} backend API (see bottom of this function)
 */
export function createAlive(host, opts = {}) {
injectStyle();
const stage = document.createElement('div');
stage.className = 'rbl-alive';
stage.innerHTML = '<canvas data-r="cv"></canvas><canvas data-r="cv3" style="display:none"></canvas>' +
  '<div class="rbl-fx rbl-scan"></div><div class="rbl-fx rbl-chroma"></div><div class="rbl-fx rbl-vig"></div>' +
  '<div data-r="bootui" class="rbl-bootui"><div data-r="wordmark" class="rbl-wordmark">RaBbLE</div>' +
  '<div data-r="tagline" class="rbl-tagline">Low Entropy. Infinite Resonance.</div>' +
  '<div data-r="bar" class="rbl-bar"><i></i></div><div data-r="pct" class="rbl-pct"></div><div data-r="log" class="rbl-log"></div></div>';
host.appendChild(stage);
const $ = (id) => stage.querySelector(`[data-r="${id}"]`);
// Safe-area probe: env() can't be read from JS directly, so measure it. --rbl-safe-* override for testing/hosts.
const safeProbe = document.createElement('div');
safeProbe.setAttribute('aria-hidden', 'true');
safeProbe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;left:0;top:0;width:0;height:0;' +
  'padding:var(--rbl-safe-top,env(safe-area-inset-top,0px)) var(--rbl-safe-right,env(safe-area-inset-right,0px)) ' +
  'var(--rbl-safe-bottom,env(safe-area-inset-bottom,0px)) var(--rbl-safe-left,env(safe-area-inset-left,0px))';
stage.appendChild(safeProbe);
const SAFE = { t: 0, r: 0, b: 0, l: 0 };
function readSafe() {
  const cs = getComputedStyle(safeProbe);
  SAFE.t = parseFloat(cs.paddingTop) || 0; SAFE.r = parseFloat(cs.paddingRight) || 0;
  SAFE.b = parseFloat(cs.paddingBottom) || 0; SAFE.l = parseFloat(cs.paddingLeft) || 0;
}
const listeners = [];
const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); listeners.push([t, ev, fn, o]); };
const emit = (name, detail) => host.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
let rafId = 0, ro = null, disposed = false, paused = false;
const PAL = readPalette(host);

// ---- behaviour layers declared before the renderer body (it calls setExpr -> emitState at mount)
let stateS = 'idle';
const moodS = { name: 'idle', since: 0, next: 4, until: 0, auto: opts.autonomous !== false, fx1: 0, fx2: 0 };
const MOOD_FX = {
  idle:    { squint: 0,   gx: 0,  gy: 0,  dart: 0, pulse: 1,   spin: 0,    tilt: 0 },
  ponder:  { squint: .22, gx: 14, gy: -9, dart: 0, pulse: .6,  spin: -.06, tilt: 5 },
  process: { squint: .08, gx: 0,  gy: 2,  dart: 1, pulse: 2.6, spin: .2,   tilt: 0 },
  insight: { squint: 0,   gx: 0,  gy: -4, dart: 0, pulse: 3,   spin: .3,   tilt: 0 },
  curious: { squint: 0,   gx: 0,  gy: 0,  dart: 0, pulse: 1.2, spin: .05,  tilt: 0 },
};
const MOOD_DUR = { idle: [4, 8], ponder: [5, 9], process: [3, 5], insight: [2.8, 2.8] };
const moodFx = Object.assign({ side: 1 }, MOOD_FX.idle);
let lastEmit = '';
function legacyState() { return stateS === 'idle' && moodS.name === 'process' ? 'thinking' : stateS; }
function emitState() {
  const detail = { state: stateS, mood: moodS.name, emotion: typeof emotion === 'undefined' ? 'calm' : emotion,
    dimension: typeof mode === 'undefined' ? '2d' : mode };
  const key = detail.state + detail.mood + detail.emotion + detail.dimension;
  if (key === lastEmit) return;
  lastEmit = key;
  emit('entity-state', detail);
  window.dispatchEvent(new CustomEvent('rabble:entity-state', { detail: { state: legacyState(), mood: detail.mood, emotion: detail.emotion } }));
}

// ============================================================ utilities
const TAU=Math.PI*2, rnd=(a,b)=>a+Math.random()*(b-a), clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>t<=0?0:t>=1?1:t*t*(3-2*t), easeOut=t=>t<=0?0:t>=1?1:1-Math.pow(1-t,3), easeIO=t=>t<=0?0:t>=1?1:(t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2);
const seg=(t,a,b)=>clamp((t-a)/(b-a),0,1);
const P=new Float32Array(1024);for(let i=0;i<1024;i++)P[i]=Math.random()*2-1;
function noise(x){const i=Math.floor(x),f=x-i,u=f*f*(3-2*f);return P[i&1023]*(1-u)+P[(i+1)&1023]*u;}
function fbm(x){return noise(x)*.6+noise(x*2.3+17.1)*.3+noise(x*5.1+41.7)*.1;}
const reduce=!!(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches);

// ============================================================ palette (Aether tokens)
// Canonical swaps for the source's off-palette hexes: RaBbLE-Grimoire/RaBbLE-Agent/RaBbLE-Palette-Candidates.md
const C={a:PAL.cyan,b:PAL.magenta,violet:PAL.violet,pink:PAL.pink,void:PAL.bg,deep:PAL.bg,glow:PAL.surface,eye:PAL.text,
  nebula:[PAL.cyan,PAL.cyan,PAL.violet,PAL.violet,PAL.cyan,PAL.cyan,PAL.text,PAL.text]};
let poleL=C.a,poleR=C.b; // pole A left by default; setPortals() recolors
function rgba(hex,a){const n=parseInt(hex.slice(1),16);return `rgba(${n>>16},${(n>>8)&255},${n&255},${a})`;}

// ============================================================ canvas + camera
const cv=$("cv"),cv3=$("cv3"),ctx2d=cv.getContext("2d");let ctx=ctx2d;
let W=0,H=0,DPR=1,dprCap=3,cam={s:1,ox:0,oy:0,vw:1600,vh:900};
function resize(){
  const r=cv.getBoundingClientRect();W=Math.max(1,r.width);H=Math.max(1,r.height);
  DPR=Math.min(window.devicePixelRatio||1,dprCap);cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR);
  const a=W/H;cam.vw=a>=1.3?1600:a>=1?1300:a>=.75?1150:1000;cam.vh=cam.vw/a;
  if(a>=1.3&&cam.vh<900){/* very wide: keep full height */cam.vh=Math.max(cam.vh,720);cam.vw=cam.vh*a;}
  readSafe();cam.s=W/cam.vw;cam.ox=(W+SAFE.l-SAFE.r)/2-800*cam.s;cam.oy=(H+SAFE.t-SAFE.b)/2-450*cam.s;layoutUI();
}
const toWorld=(x,y)=>({x:(x-cam.ox)/cam.s,y:(y-cam.oy)/cam.s});
const portrait=()=>W/H<1;

// ============================================================ entity placement (boot: left quarter / portrait top, then slides to center)
const E={x:800,y:450,s:1,w:1};
const spreadX=u=>{const a=Math.abs(u);return a<=265?u:Math.sign(u)*(265+(a-265)*E.w);};
const finalS=()=>portrait()?1.35:1;
function bootPlace(){return portrait()?{x:800,y:450-cam.vh*.17,s:.82,w:.62}:{x:800-cam.vw*.24,y:450,s:.8,w:.45};}

// ============================================================ timing / state
let time=0,ltime=0,travel=0,last=null,energy=0,pointer={x:0,y:0,wx:null,wy:null,active:false,t:-99,down:false,downT:0};
const boot={t:0,on:false,done:false,dormant:true,skipped:false,slideT:-1,holding:false,readyFired:false,startedAt:0};
const BOOT={grid:[0,1.6],motes:[0,2.8],sphere:[.9,2.3],portalArc:[.4,3.4],eyeRise:[1.8,4.2],blinks:4.25,mesh:[2.2,4.2],lens:[2.9,3.9],orbit:[3.0,4.1],bokeh:[1.4,3.2],
  logStart:.7,logEnd:7.0,ready:7.4,slide:[7.6,9.8],shock:9.6,idle:10.2};
const rv=k=>boot.done?1:(Array.isArray(BOOT[k])?ease(seg(boot.t,BOOT[k][0],BOOT[k][1])):1);

// ============================================================ face rig: 4 ellipses with independent params
// face units: eyes 87 x 272 at (+-92, 0); portals 234 x 70 centered +-126 from their eye (NeBuLA idle baseline, symmetric)
const EYE_RX=43.5,EYE_RY=136,POR_RX=117,POR_RY=35,EYE_X=92,POR_OFF=126;
const ELS=["eL","eR","pL","pR"],KEYS=["dx","dy","rot","sx","sy"];
const LIM={e:{dx:[-34,34],dy:[-60,60],rot:[-20,20],sx:[.78,1.22],sy:[.3,1.22]},p:{dx:[-40,40],dy:[-270,270],rot:[-22,22],sx:[.78,1.25],sy:[.6,1.4]}};
function Z(){return{dx:0,dy:0,rot:0,sx:1,sy:1};}
const X=(o)=>Object.assign(Z(),o);
const EXPR={
  // Calm: the idle baseline. Joy: portals lift and tilt, the lower portal rises into its orb to carve a crescent.
  // Sad: orbs droop and tilt inward, one sinks into its portal. Angry: portals clamp onto the orbs like furrowed brows.
  calm: {eL:X({}),eR:X({}),pL:X({}),pR:X({}),tilt:0,gaze:1},
  joy:  {eL:X({dy:-6,sy:.86,sx:1.05,rot:-6}),eR:X({dy:-6,sy:.86,sx:1.05,rot:6}),pL:X({dy:-20,rot:-8,sx:1.06}),pR:X({dy:-56,rot:8,sx:1.08}),tilt:2,gaze:.95},
  sad:  {eL:X({dy:14,sy:.9,rot:7,sx:.96}),eR:X({dy:18,sy:.9,rot:-7,sx:.96}),pL:X({dy:12,rot:10,sx:.96}),pR:X({dy:-12,rot:-6,sx:.97}),tilt:-4,gaze:.7},
  angry:{eL:X({dy:4,sy:.86,rot:-6,sx:1.03}),eR:X({dy:-4,sy:.86,rot:6,sx:1.03}),pL:X({dy:40,rot:-12,sx:1.08,dx:8}),pR:X({dy:-40,rot:12,sx:1.08,dx:-8}),tilt:0,gaze:1.1},
  listening:{eL:X({sy:1.04}),eR:X({sy:1.04}),pL:X({dy:252}),pR:X({dy:-252}),tilt:0,gaze:1.2},
  speaking: {eL:X({}),eR:X({}),pL:X({dy:-44,sx:1.05}),pR:X({dy:44,sx:1.05}),tilt:0,gaze:.8}
};
const EMOTIONS=["calm","joy","sad","angry"];
// each emotion also drives the body and the aura
const STYLE={
  calm: {energy:.05,glow:.5,tempo:.8,bounce:0,hop:0,trem:0,gazeY:0,orbit:.7,sphere:0,lens:1,jit:1,pulse:.8,strike:.6,surf:.7,grav:0,bpm:46,sparkle:0,sigh:0,dim:1,stiff:50},
  joy:  {energy:.3,glow:.8,tempo:1.2,bounce:6,hop:.8,trem:0,gazeY:-3,orbit:1.5,sphere:.06,lens:1.04,jit:1.1,pulse:1.6,strike:.9,surf:1.2,grav:-4,bpm:70,sparkle:.6,sigh:0,dim:1.08,stiff:70},
  sad:  {energy:.02,glow:.4,tempo:.6,bounce:0,hop:0,trem:0,gazeY:6,orbit:.45,sphere:-.04,lens:.92,jit:.7,pulse:.5,strike:.3,surf:.45,grav:18,bpm:42,sparkle:0,sigh:1,dim:.82,stiff:35},
  angry:{energy:.45,glow:.85,tempo:1.2,bounce:0,hop:0,trem:.5,gazeY:0,orbit:1.6,sphere:.14,lens:1.05,jit:1.8,pulse:1.8,strike:2,surf:1.8,grav:0,bpm:84,sparkle:0,sigh:0,dim:1.04,stiff:90}
};
const sty=Object.assign({},STYLE.calm);let styT=STYLE.calm,emotion="calm";
function stepStyle(dt){const k=1-Math.pow(.08,dt);for(const key in styT)sty[key]+=(styT[key]-sty[key])*k;}
let sighT=-1,nextSigh=6;
function sighAmt(){return sighT<0?0:Math.sin(Math.PI*clamp(sighT/1.8,0,1));}
// live param state with springs
const F={};ELS.forEach(e=>{F[e]={};KEYS.forEach(k=>{const v=(k==="sx"||k==="sy")?1:0;F[e][k]={v,vel:0,t:v};});});
const head={tilt:{v:0,vel:0,t:0},gaze:1};
let expr="calm",exprUntil=0,stiff=50;
function setExpr(name,hold){
  const p=EXPR[name];if(!p)return;expr=name;exprUntil=hold?time+hold:0;
  ELS.forEach(e=>{const lim=LIM[e[0]];KEYS.forEach(k=>{F[e][k].t=clamp(p[e][k],lim[k][0],lim[k][1]);});});
  head.tilt.t=p.tilt;head.gaze=p.gaze;
  if(STYLE[name]){emotion=name;styT=STYLE[name];}
  stiff=name==="listening"?55:name==="speaking"?80:STYLE[name].stiff;
  emitState();
}
function stepSprings(dt){
  const k=stiff,c=2*Math.sqrt(k)*.72;
  ELS.forEach(e=>KEYS.forEach(q=>{const s=F[e][q];s.vel+=((s.t-s.v)*k-s.vel*c)*dt;s.v+=s.vel*dt;}));
  const s=head.tilt;s.vel+=((s.t-s.v)*40-s.vel*2*Math.sqrt(40)*.8)*dt;s.v+=s.vel*dt;
}

// ============================================================ eyes: gaze, blinks, reactions
const eye={gx:0,gy:0,vx:0,vy:0,micro:[0,0],nextMicro:1,nextBlink:4,blinkT:-1,dbl:false,attn:null,flinch:0,widen:0,burst:null};
function startBlink(d){if(eye.blinkT<0){eye.blinkT=0;eye.dbl=!!d;}}
function bumpAt(x){if(x<0)return 0;if(x<.16)return Math.sin(Math.PI*x/.16);if(eye.dbl&&x>=.24&&x<.4)return Math.sin(Math.PI*(x-.24)/.16);return 0;}
function blinkAmt(side){
  let b=0;
  if(eye.blinkT>=0)b=bumpAt(eye.blinkT-(side?0.04:0));
  if(eye.burst){ // boot blink burst: 5 blinks, each gap 55% longer
    const bt=boot.t-eye.burst.t0;let at=0,gap=.06;
    for(let i=0;i<5;i++){const x=bt-at-(side?.025:0);if(x>=0&&x<.1)b=Math.max(b,Math.sin(Math.PI*x/.1));at+=.1+gap;gap*=1.55;}
    if(bt>at+.3)eye.burst=null;
  }
  return b;
}

// ============================================================ aura: mesh, bokeh, motes, sphere, orbit, lens, fx
// mesh (relative to entity center, in orb units; scaled by E.s)
const nodes=[],edges=[],ekey=new Set();
(function buildMesh(){
  const L=[[8,140,320,.66,40],[7,300,450,.54,34],[6,430,575,.44,26]];
  const add=(x,y,side,layer,amp)=>{const n={id:nodes.length,bx:x,by:y,x,y,side,layer,amp,s:rnd(0,800),ph:rnd(-.6,.6),orr:rnd(4,14),ow:rnd(.25,.8)*(Math.random()<.5?-1:1),hot:0,out:[],inn:[],dx:0,dy:0,pop:0};nodes.push(n);return n;};
  for(const side of [-1,1]){
    add(side*800,0,side,-1,0);
    L.forEach(([cnt,d0,d1,sp,amp],li)=>{for(let k=0;k<cnt;k++){const d=rnd(d0,d1);add(side*(800-d),(k-(cnt-1)/2)/((cnt-1)/2)*sp*330+rnd(-22,22),side,li,amp);}});
    for(let k=0;k<7;k++){const a=(side<0?Math.PI:0)+(k-3)*.36;add(255*Math.cos(a),255*Math.sin(a),side,3,10);}
  }
  const near=(n,l,k)=>nodes.filter(m=>m.side===n.side&&m.layer===l&&m!==n).sort((a,b)=>Math.hypot(a.bx-n.bx,a.by-n.by)-Math.hypot(b.bx-n.bx,b.by-n.by)).slice(0,k);
  const link=(a,b,f)=>{const k=a.id<b.id?a.id+"_"+b.id:b.id+"_"+a.id;if(ekey.has(k))return;ekey.add(k);edges.push({a,b});if(f){a.out.push(b);b.inn.push(a);}};
  for(const n of nodes){
    if(n.layer===-1)nodes.filter(m=>m.side===n.side&&m.layer===0).forEach(m=>link(n,m,true));
    else if(n.layer<3){near(n,n.layer+1,3).forEach(m=>link(n,m,true));near(n,n.layer,2).forEach(m=>link(n,m,false));if(n.layer===0&&Math.random()<.5)near(n,2,1).forEach(m=>link(n,m,true));}
    else near(n,3,2).forEach(m=>link(n,m,false));
  }
})();
const anchors={"-1":nodes.find(n=>n.layer===-1&&n.side===-1),"1":nodes.find(n=>n.layer===-1&&n.side===1)};
const pulses=[];for(let i=0;i<28;i++)pulses.push({on:false});
const bokeh=[];for(let i=0;i<120;i++){const a=rnd(0,TAU),r=270*Math.sqrt(Math.random());bokeh.push({x:r*Math.cos(a)*1.1,y:r*Math.sin(a),r:rnd(6,24),c:C.nebula[(Math.random()*8)|0],op:rnd(.16,.45),s:rnd(0,500)});}
const motes=[];for(let i=0;i<150;i++)motes.push({x:0,y:0,age:9,life:1,s:rnd(0,900),r:1,c:[C.a,C.b,C.eye][(Math.random()*3)|0],boot:true});
const embers=[];for(let i=0;i<46;i++)embers.push({x:0,y:0,vy:0,age:9,life:1,s:rnd(0,900),r:1});
const sparks=[];for(let i=0;i<160;i++)sparks.push({life:0});
const flashes=[];for(let i=0;i<10;i++)flashes.push({life:0});
const rings=[];for(let i=0;i<8;i++)rings.push({life:0});
const bolts=[];for(let i=0;i<10;i++)bolts.push({life:0});
const circles=[];
for(let i=0;i<6;i++){const lon=i*Math.PI/6,pts=[];for(let s=0;s<=40;s++){const a=s/40*TAU;pts.push([Math.cos(a)*Math.sin(lon),Math.sin(a),Math.cos(a)*Math.cos(lon)]);}circles.push({pts,kind:"m",i});}
[-1.05,-.52,0,.52,1.05].forEach((lat,j)=>{const pts=[];for(let s=0;s<=40;s++){const a=s/40*TAU;pts.push([Math.cos(lat)*Math.sin(a),Math.sin(lat),Math.cos(lat)*Math.cos(a)]);}circles.push({pts,kind:"p",i:j});});
let yaw=0,yawV=.1;
const strands=[];[-1,1].forEach(sg=>[[330,4,1],[300,2.2,1.4],[250,1.4,1.9]].forEach(([amp,w,spd])=>strands.push({sg,amp,w,spd,s:rnd(0,700),jit:new Float32Array(91),jt:new Float32Array(91)})));
let jitT=0;

function spawnSpark(x,y,n,col){const base=Math.atan2(y-E.y,x-E.x);for(let i=0;i<n;i++){const s=sparks.find(s=>s.life<=0);if(!s)return;const a=base+rnd(-1.3,1.3),v=rnd(120,420);Object.assign(s,{x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rnd(.3,.8),c:Math.random()<.5?C.eye:col});s.max=s.life;}}
function flash(x,y,size){const f=flashes.find(f=>f.life<=0);if(f)Object.assign(f,{x,y,size,life:.35});}
function ring(x,y,col,size){const r=rings.find(r=>r.life<=0);if(r)Object.assign(r,{x,y,col,size:size||1,life:1});}
function jag(x0,y0,x1,y1,rough,depth){let pts=[[x0,y0],[x1,y1]];for(let d=0;d<depth;d++){const n=[pts[0]];for(let i=0;i<pts.length-1;i++){const p=pts[i],q=pts[i+1],mx=(p[0]+q[0])/2,my=(p[1]+q[1])/2,dx=q[0]-p[0],dy=q[1]-p[1],L=Math.hypot(dx,dy)||1,o=(Math.random()*2-1)*L*rough;n.push([mx-dy/L*o,my+dx/L*o],q);}pts=n;}return pts;}
function bolt(kind,tx,ty){
  const b=bolts.find(b=>b.life<=0);if(!b)return;const side=Math.random()<.5?-1:1;
  if(kind==="in"){const ang=rnd(-1.1,1.1);Object.assign(b,{x0:E.x+spreadX(side*800)*E.s,y0:E.y+rnd(-30,30),x1:E.x+side*265*E.s*Math.cos(ang)*.92,y1:E.y+265*E.s*Math.sin(ang)*.92,col:side<0?poleL:poleR,w:2.4,life:rnd(.25,.5),rough:.22});flash(b.x1,b.y1,1);spawnSpark(b.x1,b.y1,14,b.col);energy=Math.min(1,energy+.18);glance(b.x1,b.y1,side);}
  else if(kind==="to"){const a=Math.atan2(ty-E.y,tx-E.x);Object.assign(b,{x0:E.x+265*E.s*Math.cos(a),y0:E.y+265*E.s*Math.sin(a),x1:tx,y1:ty,col:Math.random()<.5?poleL:poleR,w:2,life:.35,rough:.2});}
  else {const a0=rnd(0,TAU),a1=a0+rnd(.35,.9)*(Math.random()<.5?-1:1),R=265*E.s;Object.assign(b,{x0:E.x+R*Math.cos(a0),y0:E.y+R*Math.sin(a0),x1:E.x+R*Math.cos(a1),y1:E.y+R*Math.sin(a1),col:C.eye,w:1.3,life:rnd(.12,.25),rough:.14});}
  b.max=b.life;b.rej=0;b.pts=null;
}
function glance(x,y,side){eye.attn={x,y,until:time+rnd(.5,.9)};eye.flinch=side;}

// ============================================================ mind: autonomous expressions, interaction states
const mind={auto:opts.autonomous!==false,next:6,manualUntil:0,lastInteract:0,lonely:false,talkT:-1,listening:false,pokes:[]};
function autoTick(){
  if(!boot.done||!mind.auto||time<mind.manualUntil||mind.listening||mind.talkT>=0||stateS!=="idle")return;
  if(!mind.lonely&&time-mind.lastInteract>45){mind.lonely=true;setExpr("sad");return;} // left alone too long
  if(mind.lonely)return;
  if(exprUntil&&time>exprUntil){setExpr("calm");mind.next=time+rnd(6,11);return;}
  if(!exprUntil&&time>mind.next){const r=Math.random();setExpr(r<.6?"joy":r<.85?"sad":"angry",rnd(3,6));}
}
function interact(){mind.lastInteract=time;if(mind.lonely){mind.lonely=false;setExpr("joy",3.5);mind.manualUntil=time+3.5;}}

// ============================================================ per-frame geometry of the 4 ellipses (face units, relative to entity center)
const portalSide={L:{below:null},R:{below:null}};
function faceGeom(){
  const f=E.s*.7,g=[];
  const bL=blinkAmt(0),bR=blinkAmt(1);
  const talk=mind.talkT>=0?(.5+.5*noise(time*9))*.35:0;
  // boot choreography
  const slit=1,open=1; // portals are drawn at full size; the boot reveals them as sweeping arcs (see renderFaceCore)
  const rise=boot.done?1:easeIO(seg(boot.t,BOOT.eyeRise[0],BOOT.eyeRise[1]));
  const breathe=.02*Math.sin(ltime*1.25);
  const sides=[["eL","pL",-1,bL],["eR","pR",1,bR]];
  for(const [ek,pk,sd,bl] of sides){
    const e=F[ek],p=F[pk],s=sd<0?"L":"R";
    const n=ltime*.5+(sd<0?0:37);
    // independent living motion
    const ejx=2.5*fbm(n),ejy=3*fbm(n+11),ejr=1.2*fbm(n+23);
    const pjx=3*fbm(n+51),pjy=4*fbm(n+63),pjr=1.6*fbm(n+77);
    const bob=(sd<0?-1:1)*8*Math.sin(ltime*1.4+(sd<0?0:1.1))*(1+energy*.6);
    const tr=sty.trem>.05?sty.trem:0,tx=tr?rnd(-tr,tr):0,ty=tr?rnd(-tr,tr):0;
    const porBaseY=sd<0?-POR_OFF:POR_OFF;
    let ex=sd*EYE_X+e.dx.v+eye.gx*head.gaze+ejx+(eye.flinch===sd?-sd*6:0)+tx;
    let ey=e.dy.v+eye.gy*head.gaze+ejy+sty.gazeY+ty+sighAmt()*4;
    let ery=EYE_RY*e.sy.v*(1-.95*bl)*(1+breathe+eye.widen*.12-talk*.4*(sd<0?1:.7))*(1-moodFx.squint*(moodFx.side===sd?1:.35));
    let erx=EYE_RX*e.sx.v*(1+.22*bl)*(1+eye.widen*.05);
    // eyes emerge from their portals during boot: start at the portal center, rise to rest
    const py0=porBaseY+p.dy.v;
    const op=easeIO(rise);ey=lerp(py0,ey,op);ery*=lerp(.02,1,op*op*(1.6-.6*op));erx*=lerp(.85,1,op);
    const px=sd*EYE_X+p.dx.v+eye.gx*.25*head.gaze+pjx, py=porBaseY+p.dy.v+bob+pjy;
    // which side of its orb is this portal on? decided from the rig (not jitter), with hysteresis so near-level poses never flicker
    const rel=(porBaseY+p.dy.v)-e.dy.v,st=portalSide[s];if(st.below===null)st.below=rel>0;else if(st.below&&rel<-24)st.below=false;else if(!st.below&&rel>24)st.below=true;
    g.push({side:sd,col:sd<0?poleL:poleR,below:st.below,
      eye:{x:ex,y:ey,rx:erx,ry:Math.max(1,ery),rot:(e.rot.v+ejr)*Math.PI/180},
      por:{x:px,y:py,rx:POR_RX*p.sx.v*lerp(.02,1,slit),ry:POR_RY*p.sy.v*lerp(.03,1,open),rot:(p.rot.v+pjr)*Math.PI/180}});
  }
  return {f,g};
}

// ============================================================ drawing helpers
function strokeTriple(w,col,path){ctx.strokeStyle=col;ctx.globalAlpha=.12;ctx.lineWidth=w*3.7;path();ctx.stroke();ctx.globalAlpha=.3;ctx.lineWidth=w*2.2;ctx.stroke();ctx.globalAlpha=1;ctx.lineWidth=w;ctx.stroke();}
function haloFill(col,op){const gc=ctx.__g||(ctx.__g={});let g=gc[col];if(!g){g=ctx.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,rgba(col,.9));g.addColorStop(.45,rgba(col,.35));g.addColorStop(1,rgba(col,0));gc[col]=g;}ctx.globalAlpha=op;ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,1,0,TAU);ctx.fill();ctx.globalAlpha=1;}
function halo(x,y,rx,ry,rot,col,op){if(rx<.5||ry<.5)return;ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(rx,ry);haloFill(col,op);ctx.restore();}
function ell(x,y,rx,ry,rot){ctx.beginPath();ctx.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),rot,0,TAU);}

// ============================================================ render: environment
function drawBackground(){
  const g=ctx.createRadialGradient(W/2,H*.45,0,W/2,H*.45,Math.max(W,H)*.75);g.addColorStop(0,C.glow);g.addColorStop(1,C.void);
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
}
// 2D grid = the same scene as 3D seen through a pinhole: floor at Y=-1, ceiling at Y=+1 (units: plane half-gap),
// depth Z, screen = horizon + 380*Y/Z. Rays run along Z and slide sideways (travel along the wide side of the aura);
// rows are fixed depths. A gravity well at the entity lifts the floor and lowers the ceiling toward it.
// The entity repels spacetime: a trampoline-shaped dent (steep near it, long soft tails) pushes the floor DOWN and
// the ceiling UP, so both planes bend away and wrap around it. The dent is centered on the entity and follows it.
// Shared space-time grid (world units, entity at the origin): floor at y=-GAP, ceiling at y=+GAP, rays along z every 340
// that slide sideways with the travel, rows across x every 400. The entity repels spacetime with a trampoline-shaped dent
// (floor pushed down, ceiling pushed up). 3D draws it with WebGL; 2D projects the exact same geometry through a
// matching pinhole camera, so the warp is identical in both.
const GAP=240,WELL={A:150,SX:640,SZ:520},RAY=340,ROW=400;
const GW={k:1,x3:0};
function wellShape(dx,dz){return 1/Math.pow(1+dx*dx+dz*dz,1.35);}
function well3(x,z){return WELL.A*GW.k*wellShape((x-GW.x3)/WELL.SX,z/WELL.SZ);}
function wellStep(){GW.k=(1+energy*.25+heart*.08)*(boot.done?1:ease(seg(boot.t,BOOT.sphere[0],BOOT.eyeRise[1])));GW.x3=(E.x-800)/Math.max(.3,E.s);}
// breakpoints: fine near the dent, coarse far away; the grid is re-centered on the camera each frame so it never ends
function breaks(lo,hi,fineLo,fineHi,fine,coarse){const b=[];let v=lo;while(v<hi){b.push(v);v+=(v>=fineLo&&v<fineHi)?fine:coarse;}b.push(hi);return b;}
const fadeK=d=>Math.exp(-Math.pow(d/8200,2)*2.4);
// ---- 2D: pinhole camera matching the 3D default view (elevation .1, distance 1700)
const P2={el:.02,D:1700};
function drawGrid(dt){
  const t=boot.done?1:seg(boot.t,BOOT.grid[0],BOOT.grid[1]);if(t<=0)return;
  ctx.save();ctx.translate(cam.ox,cam.oy);ctx.scale(cam.s,cam.s);
  const se=Math.sin(P2.el),ce=Math.cos(P2.el),D=P2.D,Cy=D*se,Cz=D*ce,left=(-cam.ox)/cam.s,right=(W-cam.ox)/cam.s;
  const HZy=450-D*se/ce;
  const proj=(X,Y,Z)=>{const vy=Y-Cy,vz=Z-Cz,dp=-vy*se-vz*ce;if(dp<60)return null;return[800+D*X/dp,450-D*(vy*ce-vz*se)/dp,dp];};
  // horizon ignition
  const ign=easeOut(seg(t,0,.45));ctx.strokeStyle=C.eye;ctx.globalAlpha=.9*(1-seg(t,.5,1))+.15;ctx.lineWidth=2.2/cam.s;
  ctx.beginPath();ctx.moveTo(800-(800-left)*ign,HZy);ctx.lineTo(800+(right-800)*ign,HZy);ctx.stroke();
  const reveal=easeOut(seg(t,.25,1)),off=((travel%RAY)+RAY)%RAY,EXT=9000,BANDS=5;
  const xs=[],x0=Math.floor(-EXT/RAY)*RAY;for(let x=x0;x<=EXT;x+=RAY)xs.push(x-off);
  const zR=breaks(-14000,Cz-80,-2600,2600,150,900),xR=breaks(-EXT,EXT,-2600,2600,130,700),zRows=[];for(let z=-14000;z<Cz-80;z+=ROW)zRows.push(z);
  for(const [sg,col,op] of [[1,C.pink,.75],[-1,C.a,.5]]){
    const bands=[];for(let b=0;b<BANDS;b++)bands.push(new Path2D());
    const Y=(x,z)=>sg>0?-GAP-well3(x,z):GAP+well3(x,z);
    const add=(a,b)=>{if(!a||!b)return;const d=(a[2]+b[2])/2,bi=Math.min(BANDS-1,Math.floor(Math.pow(d/12000,.6)*BANDS));bands[bi].moveTo(a[0],a[1]);bands[bi].lineTo(b[0],b[1]);};
    for(const x of xs){let prev=null;for(const z of zR){const p=proj(x,Y(x,z),z);add(prev,p);prev=p;}}
    for(const z of zRows){if(-z>14000*(1-reveal)+1&&reveal<1){}const rv2=reveal>=1||(z<-14000+(14000+Cz)*reveal);if(!rv2)continue;let prev=null;for(const x of xR){const p=proj(x,Y(x,z),z);add(prev,p);prev=p;}}
    ctx.strokeStyle=col;ctx.lineWidth=1.6;
    for(let b=0;b<BANDS;b++){const dmid=12000*Math.pow((b+.5)/BANDS,1/.6);ctx.globalAlpha=op*fadeK(dmid)*Math.min(1,t*1.4);ctx.stroke(bands[b]);}
  }
  ctx.restore();ctx.globalAlpha=1;
}
// deep-space particles behind the orb, streaming sideways with parallax (matches the 3D starfield)
const stars=[];for(let i=0;i<280;i++)stars.push({x:Math.random(),y:Math.random(),z:rnd(.15,1),r:rnd(.5,2.2),c:C.nebula[(Math.random()*8)|0],s:rnd(0,900)});
function drawStars(dt){
  const on=boot.dormant?.35:boot.done?1:seg(boot.t,.2,2);if(on<=0)return;
  const left=(-cam.ox)/cam.s,right=(W-cam.ox)/cam.s,top=(-cam.oy)/cam.s,bot=(H-cam.oy)/cam.s,w=right-left,h=bot-top,v=(90+energy*140)*dt;
  for(const p of stars){p.x-=v*p.z/w;if(p.x<-.02)p.x+=1.04;const x=left+p.x*w,y=top+p.y*h;
    ctx.globalAlpha=on*p.z*(.35+.65*noise(time*1.3+p.s))*.9*sty.dim;ctx.fillStyle=p.c;ctx.beginPath();ctx.arc(x,y,p.r*(.6+p.z),0,TAU);ctx.fill();}
  ctx.globalAlpha=1;
}
// ============================================================ render: aura (world coords)
function drawHaze(){
  const on=rv("motes");if(on<=0)return;const hb=(.8+.3*noise(time*.3)+energy*.4+heart*.25)*sty.dim;
  for(const [dx,dy,rx,ry,col,op] of [[-170,0,450,382,poleL,.34],[170,0,460,390,poleR,.26],[0,0,320,272,C.violet,.3],[0,0,380,380,C.violet,.12]]){
    ctx.save();ctx.translate(E.x+dx*E.s,E.y+dy*E.s);ctx.scale(rx*E.s,ry*E.s);
    const a=op*on*hb,g=ctx.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,rgba(col,Math.min(1,a)));g.addColorStop(.22,rgba(col,Math.min(1,a*.6)));g.addColorStop(1,rgba(col,0));
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,1,0,TAU);ctx.fill();ctx.restore();
  }
}
// soft glow sprite, same falloff as the 3D glow texture (1 -> .6 at 22% -> 0)
function glowSprite(x,y,rad,col,op){if(rad<.5||op<=0)return;const gc=ctx.__gs||(ctx.__gs={});let g=gc[col];
  if(!g){g=ctx.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,rgba(col,1));g.addColorStop(.22,rgba(col,.6));g.addColorStop(1,rgba(col,0));gc[col]=g;}
  ctx.save();ctx.translate(x,y);ctx.scale(rad,rad);ctx.globalAlpha=Math.min(1,op);ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,1,0,TAU);ctx.fill();ctx.restore();}
function drawBokeh(){
  const on=rv("bokeh");if(on<=0)return;
  for(const b of bokeh){const x=E.x+(b.x+24*fbm(time*.12+b.s))*E.s,y=E.y+(b.y+24*fbm(time*.1+b.s+200))*E.s;
    glowSprite(x,y,b.r*1.7*E.s*on,b.c,b.op*.85*(.55+.45*noise(time*.7+b.s))*(1+energy*.5)*sty.dim);}
  ctx.globalAlpha=1;
}
let heart=0,beatPh=0;
let sphRot={yaw:0,pitch:.3,roll:-.15};
function drawSphere(dt,draw){
  const on=rv("sphere");if(on<=0)return;
  const target=Math.max(.02,.1+.09*fbm(time*.045+2)+energy*.45+sty.sphere+moodFx.spin);yawV+=(target-yawV)*(1-Math.pow(.25,dt));yaw+=dt*yawV;
  const pitch=.3+.38*fbm(time*.035+5),roll=-.15+.3*fbm(time*.03+9);sphRot={yaw,pitch,roll};if(!draw)return;const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),cr=Math.cos(roll),sr=Math.sin(roll),R=265*E.s;
  ctx.lineWidth=1.5;
  {const rr=R*easeOut(on),glr=Math.min(1,.55+energy*.4+heart*.2)*sty.dim*on;
   for(const [col,a0,a1] of [[poleL,Math.PI/2,Math.PI*1.5],[poleR,-Math.PI/2,Math.PI/2]]){ctx.strokeStyle=col;
     ctx.globalAlpha=.3*glr;ctx.lineWidth=10;ctx.beginPath();ctx.arc(E.x,E.y,rr,a0,a1);ctx.stroke();ctx.globalAlpha=.85*glr;ctx.lineWidth=2.2;ctx.beginPath();ctx.arc(E.x,E.y,rr,a0,a1);ctx.stroke();}
   ctx.lineWidth=1.5;}
  const backP=new Path2D(),aP=new Path2D(),bP=new Path2D();
  circles.forEach((c,ci)=>{
    // boot: latitudes scan in from the equator, meridians sweep in
    const reveal=boot.done?1:seg(on,(c.kind==="p"?Math.abs(c.i-2)*.12:.25+c.i*.08),(c.kind==="p"?Math.abs(c.i-2)*.12+.4:.25+c.i*.08+.45));if(reveal<=0)return;
    const n=Math.floor(40*reveal);let prev=null;
    for(let s=0;s<=n;s++){const p=c.pts[s];let x=p[0]*cy+p[2]*sy,z=-p[0]*sy+p[2]*cy,y=p[1];const y2=y*cp-z*sp,z2=y*sp+z*cp,x3=x*cr-y2*sr,y3=x*sr+y2*cr;
      const q=[E.x+R*x3,E.y+R*y3,z2];
      if(prev){const path=(prev[2]>0&&q[2]>0)?(q[0]<E.x?aP:bP):backP;path.moveTo(prev[0],prev[1]);path.lineTo(q[0],q[1]);}prev=q;}
  });
  ctx.strokeStyle=C.eye;ctx.globalAlpha=.14*on;ctx.stroke(backP);
  const gl=Math.min(1,.5+energy*.4+heart*.2);ctx.globalAlpha=gl*on;ctx.lineWidth=1.7;ctx.strokeStyle=poleL;ctx.stroke(aP);ctx.strokeStyle=poleR;ctx.stroke(bP);ctx.globalAlpha=1;
}
let orbitAng=0;
function drawOrbits(){
  const on=rv("orbit");if(on<=0)return;
  orbitAng+=0;[[84,360,1.2,-.22,.35,[poleL,poleR]],[56,318,-1.05,.4,-.5,[C.violet,C.eye]]].forEach(([n,r,t0,z0,spd,cols],oi)=>{
    const tilt=t0+.08*fbm(time*.1+r),tz=z0+.1*fbm(time*.08+r+7),ct=Math.cos(tilt),st=Math.sin(tilt),cz=Math.cos(tz),sz=Math.sin(tz);
    const count=Math.floor(n*on);
    for(let i=0;i<count;i++){const a=i/n*TAU+orbitAng*spd+(1-on)*4,x=Math.cos(a),z=Math.sin(a),y2=-z*st,z2=z*ct,x3=x*cz-y2*sz,y3=x*sz+y2*cz;
      ctx.globalAlpha=z2>0?.55+.45*noise(time*3+i+r):.14;ctx.fillStyle=cols[i%2];ctx.beginPath();ctx.arc(E.x+r*E.s*x3,E.y+r*E.s*y3,(1.1+(z2+1)*1.5)*E.s,0,TAU);ctx.fill();}
  });ctx.globalAlpha=1;
}
function nodeWorld(n){return{x:E.x+spreadX(n.x)*E.s,y:E.y+n.y*E.s};}
function drawMesh(dt,draw){
  const on=boot.done?1:seg(boot.t,BOOT.mesh[0],BOOT.mesh[1]);if(on<=0)return;
  for(const sd of [-1,1]){const a=anchors[sd];a.x=sd*800;a.y=22*fbm(time*.07+sd*13);}
  const pa=time-pointer.t<2.5&&pointer.wx!==null,kk=1-Math.pow(.05,dt);
  for(const n of nodes){if(n.layer<0)continue;
    const swx=30*fbm(time*.06+n.side*40),swy=42*fbm(time*.05+n.side*70+9),br=1+.06*Math.sin(time*.38+(n.side>0?1.7:0));
    const wave=22*Math.sin(time*.85-n.layer*.9+n.ph),inner=n.layer===3?.35:1;
    const tx=n.bx+inner*(n.bx*(br-1)+swx+n.orr*Math.cos(time*n.ow+n.s)+n.amp*1.6*fbm(time*.1+n.s));
    const ty=n.by+inner*(n.by*(br-1)+swy+wave+n.orr*Math.sin(time*n.ow*1.3+n.s)+n.amp*1.9*fbm(time*.09+n.s+300));
    let rx=0,ry=0;if(pa){const wx=E.x+tx*E.s,wy=E.y+ty*E.s,ddx=wx-pointer.wx,ddy=wy-pointer.wy,d=Math.hypot(ddx,ddy);if(d<240&&d>1){const f=Math.pow(1-d/240,2)*75*inner;rx=ddx/d*f;ry=ddy/d*f;}}
    n.dx+=(rx-n.dx)*kk;n.dy+=(ry-n.dy)*kk;n.x=tx+n.dx/E.s;n.y=ty+n.dy/E.s;n.hot=Math.max(0,n.hot-dt*2.2);
    // boot pop: layers light from the horizon inward
    const lp=boot.done?1:seg(on,(n.layer)*.18,(n.layer)*.18+.3);if(lp>0&&n.pop<1&&n.pop===0){n.hot=1;}n.pop=lp;
  }
  if(!draw)return;
  for(const sd of [-1,1]){const col=sd<0?poleL:poleR;const base=new Path2D(),hot=new Path2D();
    for(const e of edges){if(e.a.side!==sd)continue;const vis=Math.min(e.a.layer<0?1:e.a.pop,e.b.pop);if(vis<=0)continue;
      const A=nodeWorld(e.a),B=nodeWorld(e.b),bx=lerp(A.x,B.x,vis),by=lerp(A.y,B.y,vis);base.moveTo(A.x,A.y);base.lineTo(bx,by);if(Math.max(e.a.hot,e.b.hot)>.25){hot.moveTo(A.x,A.y);hot.lineTo(bx,by);}}
    ctx.strokeStyle=col;ctx.globalAlpha=.13*sty.dim;ctx.lineWidth=7;ctx.stroke(base);ctx.globalAlpha=(.55+energy*.2)*sty.dim;ctx.lineWidth=1.6;ctx.stroke(base);
    ctx.globalAlpha=.3;ctx.lineWidth=12;ctx.stroke(hot);ctx.globalAlpha=.9;ctx.strokeStyle=C.eye;ctx.lineWidth=2.2;ctx.stroke(hot);}
  for(const n of nodes){if(n.layer<0||n.pop<=0)continue;const p=nodeWorld(n),col=n.side<0?poleL:poleR,r=(n.layer===0?7:n.layer<3?6:5)*E.s*easeOut(n.pop);
    halo(p.x,p.y,r*(3+.9*noise(time*1.3+n.s)+n.hot*3),r*(3+.9*noise(time*1.3+n.s)+n.hot*3),0,col,1);
    ctx.strokeStyle=col;ctx.lineWidth=2.5+n.hot*2;ctx.globalAlpha=1;ctx.beginPath();ctx.arc(p.x,p.y,r+3*E.s,0,TAU);ctx.stroke();ctx.fillStyle=C.eye;ctx.beginPath();ctx.arc(p.x,p.y,r*.7,0,TAU);ctx.fill();}
  ctx.globalAlpha=1;
}
let nextPulse=0;
function drawPulses(dt,draw){
  if(!boot.done&&boot.t<BOOT.mesh[1])return;
  nextPulse-=dt;if(nextPulse<=0){const p=pulses.find(p=>!p.on);if(p){const sd=Math.random()<.5?-1:1,out=expr==="speaking"&&Math.random()<.8;
    if(out){const a=nodes.filter(n=>n.side===sd&&n.layer===3&&n.inn.length);const s=a[(Math.random()*a.length)|0];Object.assign(p,{on:true,dir:-1,a:s,b:s.inn[(Math.random()*s.inn.length)|0],t:0,sp:rnd(320,560)});}
    else{const s=anchors[sd];Object.assign(p,{on:true,dir:1,a:s,b:s.out[(Math.random()*s.out.length)|0],t:0,sp:rnd(260,480)});}}
    nextPulse=rnd(.06,.28)/(Math.max(.2,sty.pulse)*(1+energy*2)*moodFx.pulse);}
  for(const p of pulses){if(!p.on)continue;const A=nodeWorld(p.a),B=nodeWorld(p.b),L=Math.hypot(B.x-A.x,B.y-A.y)||1;p.t+=dt*p.sp*E.s/L;
    if(p.t>=1){p.b.hot=1;const list=p.dir>0?p.b.out:p.b.inn;if((p.dir>0&&p.b.layer===3)||(p.dir<0&&p.b.layer<0)||!list.length){flash(B.x,B.y,.45);if(p.dir>0)energy=Math.min(1,energy+.02);p.on=false;continue;}p.a=p.b;p.b=list[(Math.random()*list.length)|0];p.t=0;continue;}
    const x=lerp(A.x,B.x,p.t),y=lerp(A.y,B.y,p.t),col=p.a.side<0?poleL:poleR,bk=Math.min(p.t*L,36)/L;p.x=x;p.y=y;if(!draw)continue;
    ctx.strokeStyle=col;ctx.globalAlpha=.75;ctx.lineWidth=3.5;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(lerp(A.x,B.x,p.t-bk),lerp(A.y,B.y,p.t-bk));ctx.lineTo(x,y);ctx.stroke();
    halo(x,y,13,13,0,col,1);ctx.fillStyle=C.eye;ctx.globalAlpha=1;ctx.beginPath();ctx.arc(x,y,3.6,0,TAU);ctx.fill();}
  ctx.globalAlpha=1;
}
function drawLens(dt,draw){
  const on=boot.done?1:seg(boot.t,BOOT.lens[0],BOOT.lens[1]);if(on<=0)return;
  jitT-=dt;const rej=jitT<=0;if(rej)jitT=.14;const k=1-Math.pow(.004,dt);
  for(const st of strands){
    for(let i=0;i<=90;i++){if(rej)st.jt[i]=(Math.random()*2-1)*(Math.random()<.05?9:2.5)*(1+energy)*sty.jit;st.jit[i]+=(st.jt[i]-st.jit[i])*k;}
    const path=draw?new Path2D():null;st.pts=[];
    // boot: strands draw in from both horizons toward the center
    const reach=easeOut(on);let started=false;
    for(let i=0;i<=90;i++){const t=i/90;if(Math.abs(t-.5)<(1-reach)*.5)continue;const env=Math.pow(Math.sin(Math.PI*t),1.6);
      const br=(1+.06*fbm(time*.3*st.spd+st.s)+energy*.08)*sty.lens;const x=E.x+spreadX(t*1600-800)*E.s;
      const y=E.y+st.sg*(st.amp*env*br+env*(18*fbm(i*.3+time*.9*st.spd+st.s)+st.jit[i]))*E.s;
      st.pts.push(x,y);if(!draw)continue;if(!started||(reach<1&&Math.abs(t-.5)<(1-reach)*.5+.012)){path.moveTo(x,y);started=true;}else path.lineTo(x,y);}
    if(!draw)continue;
    const col=st.sg<0?poleL:poleR;ctx.lineJoin="round";ctx.lineCap="round";
    ctx.strokeStyle=col;ctx.globalAlpha=.1;ctx.lineWidth=st.w*5;ctx.stroke(path);ctx.globalAlpha=.3;ctx.lineWidth=st.w*2.2;ctx.stroke(path);
    ctx.globalAlpha=1;ctx.strokeStyle=C.eye;ctx.lineWidth=st.w;ctx.stroke(path);
  }
}
function drawMotes(dt){
  if(boot.dormant)return;const conv=boot.done?1:seg(boot.t,BOOT.motes[0],BOOT.motes[1]);if(boot.t<BOOT.motes[0]&&!boot.done)return;
  const pull=18+energy*30;
  const left=(-cam.ox)/cam.s,right=(W-cam.ox)/cam.s,top=(-cam.oy)/cam.s,bot=(H-cam.oy)/cam.s;
  for(let i=0;i<motes.length;i++){const m=motes[i];if(i>=motes.length*quality)continue;
    m.age+=dt;const dx=m.x-E.x,dy=m.y-E.y,d=Math.hypot(dx,dy)||1;
    if(m.age>m.life||d<265*E.s*.9){ // respawn at the view edge
      const side=(Math.random()*4)|0;m.x=side<2?(side?right:left):rnd(left,right);m.y=side>=2?(side===2?top:bot):rnd(top,bot);m.age=0;m.life=boot.done?rnd(5,11):rnd(1.2,2.4);m.r=rnd(.8,2.6);m.boot=!boot.done;continue;}
    const a=(fbm(m.x*.003+time*.05+m.s*.01)+fbm(m.y*.003-time*.04+50))*4;
    const rush=m.boot?(1-conv)*9+1:1; // boot convergence: motes stream into the forming orb
    m.x+=(Math.cos(a)*16-dx/d*pull*.5*rush*3-dy/d*pull*.7-24)*dt*rush;m.y+=(Math.sin(a)*16-dy/d*pull*.5*rush*3+dx/d*pull*.45+sty.grav)*dt*rush;
    ctx.globalAlpha=Math.sin(Math.PI*clamp(m.age/m.life,0,1))*(.45+.55*noise(time*2.5+m.s))*.9;ctx.fillStyle=m.c;ctx.beginPath();ctx.arc(m.x,m.y,m.r,0,TAU);ctx.fill();}
  // embers rising from the floor
  if(boot.done||boot.t>BOOT.grid[1]){for(let i=0;i<embers.length;i++){const m=embers[i];if(i>=embers.length*quality)continue;m.age+=dt;
    if(m.age>m.life||m.y<470){m.x=rnd(left,right);m.y=bot+rnd(0,60);m.vy=-rnd(25,75);m.age=0;m.life=rnd(5,12);m.r=rnd(1,2.6);continue;}
    m.y+=m.vy*(1+energy)*dt;m.x+=24*fbm(time*.3+m.s)*dt;ctx.globalAlpha=Math.min(1,(m.y-470)/220)*Math.min(1,m.age*2)*(.4+.6*noise(time*4+m.s))*.85;ctx.fillStyle=C.pink;ctx.beginPath();ctx.arc(m.x,m.y,m.r,0,TAU);ctx.fill();}}
  ctx.globalAlpha=1;
}
function drawFx(dt,draw){
  for(const b of bolts){if(b.life<=0)continue;b.life-=dt;b.rej-=dt;if(b.rej<=0||!b.pts){b.pts=jag(b.x0,b.y0,b.x1,b.y1,b.rough,6);b.rej=.045;}
    b.k=clamp(b.life/b.max,0,1)*(Math.random()<.2?.35:1);if(!draw)continue;const path=new Path2D();b.pts.forEach((p,i)=>i?path.lineTo(p[0],p[1]):path.moveTo(p[0],p[1]));const k=b.k;
    ctx.strokeStyle=b.col;ctx.globalAlpha=.1*k;ctx.lineWidth=b.w*5;ctx.stroke(path);ctx.globalAlpha=.3*k;ctx.lineWidth=b.w*2.2;ctx.stroke(path);ctx.strokeStyle=C.eye;ctx.globalAlpha=k;ctx.lineWidth=b.w;ctx.stroke(path);}
  for(const f of flashes){if(f.life<=0)continue;f.life-=dt;const p=1-Math.max(0,f.life)/.35;f.p=p;if(!draw)continue;halo(f.x,f.y,(12+70*p)*f.size,(12+70*p)*f.size,0,C.eye,(1-p)*(1-p));}
  for(const r of rings){if(r.life<=0)continue;r.life-=dt/1.2;const p=1-r.life;r.p=p;if(!draw)continue;ctx.strokeStyle=r.col;ctx.globalAlpha=(1-p)*(1-p)*.9;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(r.x,r.y,(20+300*p)*r.size,(20+300*p)*r.size*.62,0,0,TAU);ctx.stroke();}
  for(const s of sparks){if(s.life<=0)continue;s.life-=dt;s.vx*=Math.pow(.05,dt);s.vy=s.vy*Math.pow(.05,dt)+90*dt;s.x+=s.vx*dt;s.y+=s.vy*dt;const k=Math.max(0,s.life/s.max);s.k=k;if(!draw)continue;ctx.globalAlpha=k;ctx.fillStyle=s.c;ctx.beginPath();ctx.arc(s.x,s.y,.8+2.2*k,0,TAU);ctx.fill();}
  ctx.globalAlpha=1;
}

// ============================================================ render: the face (core tier), with portal occlusion
// Rule: the back rim is always behind the orb. A portal ABOVE its orb lets the orb hang out in front of its rim
// (orb hidden only past the inner edge of the back rim). A portal BELOW its orb draws its front rim over the orb,
// and the orb is hidden past that front rim. Decided by position every frame, not by color.
function renderFaceCore(g){
  const eyeOn=boot.done?1:seg(boot.t,BOOT.eyeRise[0],BOOT.eyeRise[0]+.15);
  const glowK=(sty.glow*.8+.15*noise(time*.8)+energy*.2+heart*.2)*clamp(sty.dim,.5,1.2);
  // portals (behind the orbs)
  const arc=boot.done?1:easeIO(seg(boot.t,BOOT.portalArc[0],BOOT.portalArc[1]));
  for(const s of g){const p=s.por;
    halo(p.x,p.y,p.rx*1.5,p.ry*2.6,p.rot,s.col,Math.min(1,glowK+.1)*arc);
    if(arc<1){
      const a0=s.side<0?Math.PI:0,a1=a0+TAU*arc*(s.side<0?1:-1);
      ctx.globalAlpha=seg(arc,.55,1);ctx.fillStyle=C.deep;ell(p.x,p.y,p.rx,p.ry,p.rot);ctx.fill();ctx.globalAlpha=1;
      strokeTriple(6,s.col,()=>{ctx.beginPath();ctx.ellipse(p.x,p.y,p.rx,p.ry,p.rot,a0,a1,s.side>0);});
      const hx=p.x+p.rx*Math.cos(a1)*Math.cos(p.rot)-p.ry*Math.sin(a1)*Math.sin(p.rot),hy=p.y+p.rx*Math.cos(a1)*Math.sin(p.rot)+p.ry*Math.sin(a1)*Math.cos(p.rot);
      halo(hx,hy,26,26,0,C.eye,.9);halo(hx,hy,48,48,0,s.col,.8);
      continue;
    }
    ctx.fillStyle=C.deep;ell(p.x,p.y,p.rx,p.ry,p.rot);ctx.fill();
    strokeTriple(6,s.col,()=>ell(p.x,p.y,p.rx,p.ry,p.rot));
    ctx.save();ctx.setLineDash([30,30]);ctx.lineDashOffset=-time*(80+energy*320);ctx.strokeStyle=s.col;ctx.globalAlpha=.7;ctx.lineWidth=2;ell(p.x,p.y,Math.max(1,p.rx-13),Math.max(1,p.ry-7),p.rot);ctx.stroke();ctx.restore();ctx.globalAlpha=1;
  }
  // orbs, each clipped by its own portal
  for(const s of g){const e=s.eye,p=s.por;if(eyeOn<=0)continue;
    const c=Math.cos(-p.rot),sn=Math.sin(-p.rot),lx=(e.x-p.x)*c-(e.y-p.y)*sn,ly=(e.x-p.x)*sn+(e.y-p.y)*c;
    s.portalBelow=s.below; // portal below its orb (front rim draws over the orb)
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.beginPath();
    if(!s.portalBelow){const R=Math.max(.1,p.rx-3),Q=Math.max(.1,p.ry-3);ctx.moveTo(-6000,0);ctx.lineTo(-R,0);ctx.ellipse(0,0,R,Q,0,Math.PI,TAU,false);ctx.lineTo(6000,0);ctx.lineTo(6000,6000);ctx.lineTo(-6000,6000);}
    else{ctx.moveTo(-6000,-6000);ctx.lineTo(6000,-6000);ctx.lineTo(6000,0);ctx.lineTo(p.rx,0);ctx.ellipse(0,0,p.rx,p.ry,0,0,Math.PI,false);ctx.lineTo(-6000,0);}
    ctx.closePath();ctx.rotate(-p.rot);ctx.translate(-p.x,-p.y);ctx.clip();
    halo(e.x,e.y,e.rx*2.6,e.ry*1.55,e.rot,s.col,Math.min(1,glowK+(eye.widen*.3)));
    ctx.fillStyle=C.eye;ell(e.x,e.y,e.rx,e.ry,e.rot);ctx.fill();
    strokeTriple(6,s.col,()=>ell(e.x,e.y,e.rx,e.ry,e.rot));
    ctx.restore();
  }
  // front rim over the orb, only for a portal that is below its orb
  for(const s of g){if(!s.portalBelow||arc<1)continue;const p=s.por;
    strokeTriple(6,s.col,()=>{ctx.beginPath();ctx.ellipse(p.x,p.y,p.rx,p.ry,p.rot,0,Math.PI,false);});}
  ctx.globalAlpha=1;
}

// whole-body motion from the emotion: joyful hops with squash and stretch, sad sighs
function faceBody(){
  const b=sty.bounce,ph=ltime*sty.hop*TAU,hop=b>.3?-Math.abs(Math.sin(ph))*b:0,sq=b>.3?Math.cos(ph*2)*.04*(b/14):0,sg=sighAmt();
  return{y:hop+sg*8,sx:1+sq+sg*.015,sy:1-sq-sg*.025};
}
function drawFace(){
  const G=faceGeom();if(boot.t<BOOT.portalArc[0]&&!boot.done)return;const B=faceBody();
  ctx.save();ctx.translate(E.x,E.y);ctx.rotate((head.tilt.v+moodFx.tilt)*Math.PI/180);ctx.translate(0,B.y*E.s);ctx.scale(G.f*B.sx,G.f*B.sy);
  renderFaceCore(G.g);ctx.restore();ctx.globalAlpha=1;
}

// ============================================================ boot text column (DOM)
const bootui=$("bootui"),wm=$("wordmark"),tag=$("tagline"),logEl=$("log"),barI=$("bar").firstElementChild,pct=$("pct");
if(opts.tagline!=null)tag.textContent=opts.tagline;
// Every line reports something that actually happens: render phases firing on the BOOT timeline, the palette
// tokens this renderer resolved at mount, and the host page's own steps (boot({steps}) -> completeStep/failStep).
// [time, kind, subsystem, message]  kind: k = kernel line, u = "[  OK  ] Started", t = "Reached target", r = ready, f = failed
const RENDER_LOG=[
 [0.00,"k","","NeBuLA alive renderer "+VERSION+" · "+(opts.dimension==="3d"?"3d requested, 2d boot":"2d")],
 [0.05,"k","aether","palette tokens bound: magenta="+PAL.magenta+" cyan="+PAL.cyan+" void="+PAL.bg],
 [0.14,"k","outrun0","horizon ignition, vanishing point locked at (800,450)"],
 [0.30,"k","nebula","mote field online"],
 [0.40,"k","portal0","arc sweep started (pole A)"],
 [0.46,"k","portal1","arc sweep started (pole B)"],
 [0.90,"k","orb0","wireframe lattice: 6 meridians, 5 parallels, r=265"],
 [1.60,"u","","Outrun Grid"],
 [1.80,"k","eye0","emerging from portal0"],
 [1.86,"k","eye1","emerging from portal1"],
 [2.20,"k","mesh","layer 0 up, 8 nodes/side"],
 [2.30,"u","","Orb Lattice"],
 [2.60,"k","mesh","layer 1 up, 7 nodes/side"],
 [2.80,"t","","Convergence"],
 [2.95,"k","lens","6 strands armed"],
 [3.00,"k","mesh","layer 2 up, 6 nodes/side"],
 [3.05,"k","orbit0","counter-rotation engaged"],
 [3.40,"u","","Portal Arcs"],
 [4.20,"u","","Eye Emergence"],
 [4.25,"k","eyes","blink calibration 1/5"],[4.41,"k","eyes","blink calibration 2/5"],[4.60,"k","eyes","blink calibration 3/5"],
 [4.85,"k","eyes","blink calibration 4/5"],[5.17,"k","eyes","blink calibration 5/5"],
 [5.30,"t","","Blink Rhythm"]
];
// the progress bar follows the same animation; "services" is the host's steps (or the visual tail when there are none)
const PHASES=[["grid",BOOT.grid,.06],["particles",BOOT.motes,.12],["orb",BOOT.sphere,.08],["portals",BOOT.portalArc,.16],["eyes",BOOT.eyeRise,.18],
  ["blinks",[BOOT.blinks,BOOT.blinks+.95],.1],["mesh",BOOT.mesh,.1],["lens",BOOT.lens,.05],["orbit",BOOT.orbit,.05]];
const SERVICES_W=.1;
const FOCUS=["blinks","eyes","portals"]; // the face leads the label while it boots; otherwise the newest running phase
function bootProgress(){let p=0,label=null,latest=-1;
  for(const [n,[a,b],w] of PHASES){const k=seg(boot.t,a,b);p+=k*w;if(boot.t>=a&&k<1&&a>latest){latest=a;label=n;}}
  for(const f of FOCUS){const ph=PHASES.find(x=>x[0]===f);if(boot.t>=ph[1][0]&&boot.t<ph[1][1]){label=f;break;}}
  const settled=steps.filter(s=>s.settled).length;
  p+=SERVICES_W*(steps.length?settled/steps.length:seg(boot.t,5.3,BOOT.ready));
  if(!label){const pend=steps.find(s=>!s.settled);label=pend?pend.label:boot.t<BOOT.ready?"services":"ready";}
  return{p:Math.min(1,p),label};}
let logShown=0;const logLines=[];
function layoutUI(){
  const fsz=portrait()?Math.min(44,W*.1):Math.min(64,W*.052);
  wm.style.fontSize=fsz+"px";tag.style.fontSize=Math.max(10,fsz*.2)+"px";logEl.style.fontSize=Math.max(10,fsz*.19)+"px";
  const lh=Math.max(14,fsz*.33);logEl.style.height=(lh*5)+"px";logEl.dataset.lh=lh;
  const uh=H-SAFE.t-SAFE.b; // usable height between the Dynamic Island / status bar and the home indicator
  if(portrait()){const topPx=SAFE.t+uh*.6;Object.assign(bootui.style,{left:(SAFE.l+W*.08)+"px",right:(SAFE.r+W*.08)+"px",top:topPx+"px",width:"auto",alignItems:"center"});}
  else{const cx=SAFE.l+.62*(W-SAFE.l-SAFE.r);Object.assign(bootui.style,{left:(cx-Math.min(W*.3,440))+"px",width:Math.min((W-SAFE.l-SAFE.r)*.6,880,W-SAFE.r-(cx-Math.min(W*.3,440)))+"px",top:(SAFE.t+uh*.33)+"px",right:"auto",alignItems:"flex-start"});}
  $("bar").style.width=portrait()?"80%":"70%";
  logLines.forEach((l,i)=>place(l,i));
}
function place(l,i){const lh=+logEl.dataset.lh||16,after=logLines.length-1-i;l.el.style.transform=`translateY(${(4-after)*lh}px)`;l.el.style.opacity=after>4?0:after===4?.35:1;}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function pushLog(entry){
  const [t,kind,sub,raw]=entry,msg=esc(raw),el=document.createElement("div");el.className="ln";
  const ts=`[${(t+Math.random()*.0009).toFixed(6).padStart(12," ")}]`;
  if(kind==="u")el.innerHTML=`<span class="okb">[</span><span class="ok">  OK  </span><span class="okb">]</span> <span class="msg">Started</span> <span class="rdy">${msg}</span><span class="msg">.</span>`;
  else if(kind==="f")el.innerHTML=`<span class="okb">[</span><span class="fail">FAILED</span><span class="okb">]</span> <span class="msg">Failed to start</span> <span class="rdy">${msg}</span><span class="msg">.</span>`;
  else if(kind==="t")el.innerHTML=`<span class="okb">[</span><span class="ok">  OK  </span><span class="okb">]</span> <span class="msg">Reached target</span> <span class="hi">${msg}</span><span class="msg">.</span>`;
  else if(kind==="r")el.innerHTML=`<span class="ts">${ts}</span> <span class="rdy">${msg}</span>`;
  else el.innerHTML=`<span class="ts">${ts}</span> ${sub?`<span class="sub">${esc(sub)}:</span> `:""}<span class="msg">${msg}</span>`;
  el.style.opacity=0;logEl.appendChild(el);logLines.push({el});
  if(logLines.length>7){const old=logLines.shift();old.el.remove();}
  requestAnimationFrame(()=>logLines.forEach((l,j)=>place(l,j)));
}
function bootUI(){
  if(!boot.on)return;
  wm.style.opacity=boot.t>.6?1:0;tag.style.opacity=boot.t>1.2?1:0;
  while(logShown<RENDER_LOG.length&&RENDER_LOG[logShown][0]<=boot.t)pushLog(RENDER_LOG[logShown++]);
  const bp=bootProgress();barI.style.width=(bp.p*100).toFixed(1)+"%";
  pct.innerHTML=boot.readyFired?"<b>ready</b>":boot.holding?`${Math.floor(bp.p*100)}% · waiting · <b>${esc(bp.label)}</b>`:`${Math.floor(bp.p*100)}% · <b>${esc(bp.label)}</b>`;
  if(boot.t>BOOT.slide[0])bootui.style.opacity=0;
}

// ============================================================ boot sequence controller
// The visual boot runs its choreography, then HOLDS at BOOT.ready (entity awake, log live) until every host step
// settles (completeStep/failStep, or stepTimeout). That hold is what masks a cold backend. Reduced motion runs the
// same timeline 3x faster; the slide to center still eases.
const steps=[];let bootResolve=null,bootPromise=null;
const bootSpeed=reduce?3:1,stepTimeout=(opts.stepTimeout!=null?opts.stepTimeout:45);
function settleStep(id,ok,reason){
  const s=steps.find(x=>x.id===id);if(!s||s.settled)return false;
  s.settled=true;s.ok=ok;
  pushLog(ok?[boot.t,"u","",s.label]:[boot.t,"f","",s.label+(reason?" ("+reason+")":"")]);
  emit("entity-boot-step",{id:s.id,label:s.label,ok,reason:reason||null});
  return true;
}
function bootStep(dt){
  if(!boot.on)return;
  const pending=steps.some(s=>!s.settled);
  if(pending&&stepTimeout>0&&time-boot.startedAt>stepTimeout)steps.forEach(s=>{if(!s.settled)settleStep(s.id,false,"timeout");});
  let nt=boot.t+dt*bootSpeed;
  if(steps.some(s=>!s.settled)&&nt>=BOOT.ready){nt=BOOT.ready;if(!boot.holding){boot.holding=true;emit("entity-boot-hold",{pending:steps.filter(s=>!s.settled).map(s=>s.id)});}}
  else boot.holding=false;
  boot.t=nt;
  if(!boot.readyFired&&boot.t>=BOOT.ready){boot.readyFired=true;pushLog([boot.t,"t","","Resonance"]);pushLog([boot.t,"r","",opts.readyLine||"entity online. hello."]);
    emit("entity-boot-ready",{steps:steps.map(s=>({id:s.id,ok:s.ok}))});}
  const home=bootPlace();
  const sl=easeIO(seg(boot.t,BOOT.slide[0],BOOT.slide[1]));
  E.x=lerp(home.x,800,sl);E.y=lerp(home.y,450,sl);E.s=lerp(home.s,finalS(),sl);E.w=lerp(home.w,1,sl);
  if(boot.t>=BOOT.blinks&&!eye.burstDone){eye.burst={t0:boot.t};eye.burstDone=true;}
  if(boot.t>=BOOT.eyeRise[0]&&!boot.pf){boot.pf=1;flash(E.x-92*E.s*.7,E.y-126*E.s*.7,.6);flash(E.x+92*E.s*.7,E.y+126*E.s*.7,.6);}
  if(boot.t>=BOOT.lens[0]&&!boot.lf){boot.lf=1;bolt("in");bolt("in");}
  if(boot.t>=BOOT.shock&&!boot.sf){boot.sf=1;ring(E.x,E.y,poleL,2.4);ring(E.x,E.y,poleR,1.7);flash(E.x,E.y,3.2);energy=1;eye.widen=1;setExpr("joy",2.4);}
  if(boot.t>=BOOT.idle)finishBoot();
}
function finishBoot(){
  boot.on=false;boot.done=true;boot.holding=false;E.x=800;E.y=450;E.s=finalS();E.w=1;bootui.style.opacity=0;
  mind.lastInteract=time;mind.next=time+4;moodS.next=time+rnd(4,8);
  emit("entity-boot-complete",{steps:steps.map(s=>({id:s.id,ok:s.ok}))});
  if(opts.dimension==="3d")setMode("3d");
  if(bootResolve){const r=bootResolve;bootResolve=null;r();}
}
// tap during boot: jump the visuals forward, but never past the hold while steps are pending
function skipBoot(){
  if(!boot.on)return;
  if(steps.some(s=>!s.settled)){boot.t=Math.max(boot.t,BOOT.ready);}
  else boot.t=Math.max(boot.t,BOOT.slide[0]);
  logShown=RENDER_LOG.length;
}
function reboot(){
  boot.on=false;boot.done=false;boot.dormant=true;boot.t=0;boot.pf=boot.lf=boot.sf=0;boot.holding=false;boot.readyFired=false;
  eye.burstDone=false;eye.burst=null;
  logLines.forEach(l=>l.el.remove());logLines.length=0;logShown=0;bootui.style.opacity=0;wm.style.opacity=0;tag.style.opacity=0;
  nodes.forEach(n=>{n.pop=0;});motes.forEach(m=>{m.age=9;});setExpr("calm");mind.lonely=false;if(mode==="3d")setMode("2d");
}
function startBoot(list){
  if(boot.on||boot.done)reboot();
  steps.length=0;
  (list||[]).forEach(s=>{const id=typeof s==="string"?s:s.id;if(!id||steps.some(x=>x.id===id))return;steps.push({id,label:(s&&s.label)||id,settled:false,ok:null});});
  boot.dormant=false;boot.on=true;boot.t=0;boot.startedAt=time;bootui.style.opacity=1;
  bootPromise=new Promise(r=>{bootResolve=r;});
  emit("entity-boot-start",{steps:steps.map(s=>s.id)});
  return bootPromise;
}

// ============================================================ interaction
function speak(){mind.talkT=0;setExpr("speaking");}
function onPoint(e){const r=cv.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;
  if(mode==="3d"&&T3.ready){const q=T3.toWorld(px,py);pointer.wx=q.x;pointer.wy=q.y;}else{const w=toWorld(px,py);pointer.wx=w.x;pointer.wy=w.y;}
  pointer.t=time;pointer.active=true;pointer.sx=px;pointer.sy=py;}
let holdTimer=null;
function release(){
  if(!pointer.down)return;pointer.down=false;clearTimeout(holdTimer);
  if(mind.listening&&opts.holdToListen){mind.listening=false;speak();return;}
  const onFace=Math.hypot(pointer.wx-E.x,pointer.wy-E.y)<230*E.s;
  if(onFace){eye.widen=1;flash(pointer.wx,pointer.wy,.9);spawnSpark(pointer.wx,pointer.wy,18,Math.random()<.5?poleL:poleR);energy=Math.min(1,energy+.3);
    mind.pokes=mind.pokes.filter(t=>time-t<3);mind.pokes.push(time);
    setExpr(mind.pokes.length>=4?"angry":"joy",mind.pokes.length>=4?3.5:2.5);mind.manualUntil=time+(mind.pokes.length>=4?3.5:2.5);}
  else{ring(pointer.wx,pointer.wy,Math.random()<.5?poleL:poleR,.5);bolt("to",pointer.wx,pointer.wy);eye.attn={x:pointer.wx,y:pointer.wy,until:time+.9};
    nodes.forEach(n=>{const p=nodeWorld(n);if(Math.hypot(p.x-pointer.wx,p.y-pointer.wy)<220)n.hot=1;});}
  mind.manualUntil=Math.max(mind.manualUntil,time+3);
}
const drag={on:false,x:0,y:0,moved:false},touches=new Map();let pinch0=0;
function pDown(e){
  touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touches.size===2){const [p,q]=[...touches.values()];pinch0=Math.hypot(p.x-q.x,p.y-q.y);clearTimeout(holdTimer);return;}
  onPoint(e);if(boot.on){if(opts.skippable!==false)skipBoot();return;}if(boot.dormant)return;interact();pointer.down=true;pointer.downT=time;drag.on=true;drag.x=e.clientX;drag.y=e.clientY;drag.moved=false;
  if(opts.holdToListen)holdTimer=setTimeout(()=>{if(pointer.down&&!drag.moved){mind.listening=true;setExpr("listening");ring(E.x,E.y,poleL,1.2);}},450);
}
function pMove(e){
  if(touches.has(e.pointerId))touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(touches.size===2&&mode==="3d"){const [p,q]=[...touches.values()],d=Math.hypot(p.x-q.x,p.y-q.y);if(pinch0>0){T3.zoom=clamp(T3.zoom*pinch0/d,.45,1.9);pinch0=d;}return;}
  if(!trackWindow){onPoint(e);interact();}
  if(drag.on&&mode==="3d"){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)>10){drag.moved=true;clearTimeout(holdTimer);}
    if(drag.moved){T3.uaz-=dx*.006;T3.uel=clamp(T3.uel+dy*.004,-.5,.7);drag.x=e.clientX;drag.y=e.clientY;}}
}
function pUp(e){touches.delete(e.pointerId);if(touches.size<2)pinch0=0;drag.on=false;if(drag.moved){pointer.down=false;drag.moved=false;return;}release();}
const trackWindow=opts.trackWindow!==false; // World overlays chat UI on the canvas: read the pointer from the window
if(opts.interactive!==false){
  for(const el of [cv,cv3]){on(el,"pointerdown",pDown);on(el,"pointermove",pMove);on(el,"pointerup",pUp);on(el,"pointercancel",pUp);if(!trackWindow)on(el,"pointerleave",()=>{pointer.active=false;});}
  on(cv3,"wheel",e=>{e.preventDefault();T3.zoom=clamp(T3.zoom*Math.exp(e.deltaY*.001),.45,1.9);},{passive:false});
  if(trackWindow){on(window,"pointermove",e=>{if(boot.dormant)return;onPoint(e);interact();},{passive:true});on(document,"pointerleave",()=>{pointer.active=false;});}
}

// ============================================================ per-frame eye / mind updates
function updateEyes(dt){
  // blinks
  if(eye.blinkT<0){if(time>eye.nextBlink&&!eye.burst&&boot.done)startBlink(Math.random()<.3);}
  else{eye.blinkT+=dt;if(eye.blinkT>(eye.dbl?.46:.22)){eye.blinkT=-1;eye.nextBlink=time+rnd(2,7)/(1+energy)/(emotion==="sad"?.7:1);}}
  // gaze target
  let tx,ty,stiff;
  const face=Math.max(.3,E.s*.7);
  if(eye.attn&&time<eye.attn.until){const dx=eye.attn.x-E.x,dy=eye.attn.y-E.y,L=Math.hypot(dx,dy)||1;tx=dx/L*26;ty=dy/L*12;stiff=260;}
  else{eye.attn=null;
    if(pointer.active&&time-pointer.t<2.5&&pointer.wx!==null){const dx=(pointer.wx-E.x)/face,dy=(pointer.wy-E.y)/face;tx=clamp(dx*.06,-26,26);ty=clamp(dy*.05,-12,12);stiff=110;}
    else{tx=18*fbm(time*.2+11)+moodFx.gx;ty=7*fbm(time*.25+33)+moodFx.gy;stiff=40+moodFx.dart*120;}
    eye.nextMicro-=dt;if(eye.nextMicro<=0){const a=1+moodFx.dart*3;eye.micro=[rnd(-4,4)*a,rnd(-2,2)*a];eye.nextMicro=moodFx.dart>0?rnd(.12,.4):rnd(.6,2.2);}tx+=eye.micro[0];ty+=eye.micro[1];}
  const damp=2*Math.sqrt(stiff)*.72;eye.vx+=((tx-eye.gx)*stiff-eye.vx*damp)*dt;eye.vy+=((ty-eye.gy)*stiff-eye.vy*damp)*dt;eye.gx+=eye.vx*dt;eye.gy+=eye.vy*dt;
  eye.widen*=Math.pow(.15,dt);if(eye.flinch&&Math.random()<dt*3)eye.flinch=0;
  // speaking: syllable rhythm then settle
  if(mind.talkT>=0){mind.talkT+=dt;if(mind.talkT>2.6){if(stateS==="speaking")mind.talkT=0;else{mind.talkT=-1;setExpr(emotion==='angry'?'calm':emotion);mind.next=time+3;}}}
  if(!pointer.down&&mind.listening&&stateS!=="listening"){mind.listening=false;}
  moodStep(dt);
}
function heartbeat(dt){beatPh+=dt*(sty.bpm+energy*20)/60;const p=beatPh%1;heart=Math.exp(-Math.pow((p-.05)/.035,2))+.6*Math.exp(-Math.pow((p-.24)/.04,2));}
let nextStrike=4,nextSurface=2;
function events(dt){
  if(!boot.done||reduce)return;
  nextStrike-=dt;if(nextStrike<=0){if(Math.random()<Math.min(1,sty.strike))bolt("in");nextStrike=rnd(2.5,7)/(1+energy)/Math.max(1,sty.strike);}
  nextSurface-=dt;if(nextSurface<=0){bolt("surf");nextSurface=rnd(.3,1.4)/Math.max(.2,sty.surf);}
  // joy: sparkles off the portal rims. sad: slow sighs.
  if(sty.sparkle>.3&&Math.random()<dt*6*sty.sparkle){const sd=Math.random()<.5?-1:1,k=E.s*.7;spawnSpark(E.x+(sd*92+rnd(-110,110))*k,E.y+(sd<0?-170:80)*k,2,sd<0?poleL:poleR);}
  if(sty.sigh>.5){if(sighT<0&&time>nextSigh){sighT=0;}if(sighT>=0){sighT+=dt;if(sighT>1.8){sighT=-1;nextSigh=time+rnd(5,9);}}}else sighT=-1;
}


// ============================================================ 3D renderer (Three.js r128 from cdnjs, loaded on first use)
// The orb system becomes a real 3D volume. The face (4-ellipse rig + portal occlusion) is rendered by the same
// renderFaceCore into a texture on a camera-facing decal at the orb's center.
const T3={ready:false,loading:false,zoom:1,uaz:0,uel:0,flip:1};
let mode="2d";
function toast(m){emit("entity-notice",{message:m});}
function setMode(m){
  if(m==="3d"&&!boot.done){toast("3D unlocks after boot");return;}
  if(m==="3d"&&!T3.ready){if(T3.loading)return;if(!hasWebGL()){toast("3D needs WebGL");return;}T3.loading=true;toast("loading 3D engine");
    ensureThree().then(T=>{if(disposed)return;if(T.ColorManagement)T.ColorManagement.enabled=false;installFatLines(T);
      try{init3D();T3.ready=true;setMode("3d");if(!T3.fat)toast("thin-line fallback");}catch(err){console.error("[rabble-entity alive]",err);toast("3D failed to start");}T3.loading=false;})
      .catch(()=>{T3.loading=false;toast("3D engine failed to load");});
    return;}
  mode=m;cv3.style.display=m==="3d"?"block":"none";cv.style.display=m==="3d"?"none":"block";
  if(m==="3d"){T3.resize();toast("drag to orbit · pinch or scroll to zoom");}else resize();emitState();
}
function init3D(){
  const T=window.THREE,c3=cv3;
  const renderer=new T.WebGLRenderer({canvas:c3,antialias:true,powerPreference:"high-performance"});renderer.setClearColor(new T.Color(C.void),1);
  if("outputColorSpace" in renderer)renderer.outputColorSpace=T.LinearSRGBColorSpace; // r128 look: no sRGB output transform on additive glows
  T3.renderer=renderer;
  const scene=new T.Scene();scene.fog=new T.FogExp2(new T.Color(C.void),.00030);
  const cam3=new T.PerspectiveCamera(42,1,1,40000);
  const hcache={},hx=h=>hcache[h]||(hcache[h]=new T.Color(h));
  const tex=(draw)=>{const c=document.createElement("canvas");c.width=c.height=128;draw(c.getContext("2d"));return new T.CanvasTexture(c);};
  const glow=tex(g=>{const r=g.createRadialGradient(64,64,0,64,64,64);r.addColorStop(0,"rgba(255,255,255,1)");r.addColorStop(.22,"rgba(255,255,255,.6)");r.addColorStop(1,"rgba(255,255,255,0)");g.fillStyle=r;g.fillRect(0,0,128,128);});
  const ringTex=tex(g=>{g.strokeStyle="#fff";g.lineWidth=9;g.beginPath();g.arc(64,64,44,0,TAU);g.stroke();});
  const addMat=o=>Object.assign({transparent:true,depthWrite:false,blending:T.AdditiveBlending},o);
  const add=o=>{scene.add(o);return o;};
  const to3=(x,y)=>[(x-E.x)/E.s,-(y-E.y)/E.s];

  // ---- fat lines: WebGL ignores lineWidth, so use screen-space ribbons (three/examples LineSegments2); fall back to 1px lines
  const FAT=!!(T.LineSegments2&&T.LineSegmentsGeometry&&T.LineMaterial),fats=[];
  function fat(max,{color=null,op=1,additive=true}={}){
    const vc=color===null,blending=additive?T.AdditiveBlending:T.NormalBlending;
    if(FAT){
      const g=new T.LineSegmentsGeometry();g.setPositions(new Float32Array(max*6));if(vc)g.setColors(new Float32Array(max*6));
      const m=new T.LineMaterial({linewidth:1,transparent:true,opacity:op,depthWrite:false,vertexColors:vc,color:vc?0xffffff:hx(color).getHex(),blending});
      const L=add(new T.LineSegments2(g,m));L.frustumCulled=false;
      const P=g.attributes.instanceStart.data,Cd=vc?g.attributes.instanceColorStart.data:null;
      const o={m,pos:P.array,col:Cd?Cd.array:null,commit(n){g.instanceCount=n;P.needsUpdate=true;if(Cd)Cd.needsUpdate=true;},width(px){m.linewidth=px;}};
      fats.push(o);return o;
    }
    const g=new T.BufferGeometry(),pa=new Float32Array(max*6);g.setAttribute("position",new T.BufferAttribute(pa,3));let ca=null;
    if(vc){ca=new Float32Array(max*6);g.setAttribute("color",new T.BufferAttribute(ca,3));}
    const m=new T.LineBasicMaterial({transparent:true,opacity:op,depthWrite:false,vertexColors:vc,color:vc?0xffffff:hx(color),blending});
    const L=add(new T.LineSegments(g,m));L.frustumCulled=false;
    const o={m,pos:pa,col:ca,commit(n){g.setDrawRange(0,n*2);g.attributes.position.needsUpdate=true;if(ca)g.attributes.color.needsUpdate=true;},width(){}};
    fats.push(o);return o;
  }
  const col3=(arr,i,hex,k)=>{const c=hx(hex);arr[i]=c.r*k;arr[i+1]=c.g*k;arr[i+2]=c.b*k;};
  const seg=(o,i,ax,ay,az,bx,by,bz)=>{const p=o.pos,j=i*6;p[j]=ax;p[j+1]=ay;p[j+2]=az;p[j+3]=bx;p[j+4]=by;p[j+5]=bz;};
  const scol=(o,i,hex,k)=>{const c=hx(hex),p=o.col,j=i*6;p[j]=p[j+3]=c.r*k;p[j+1]=p[j+4]=c.g*k;p[j+2]=p[j+5]=c.b*k;};

  // ---- haze (matched to the 2D radial glows)
  const haze=[[-170,0,900,.5],[170,0,920,.38],[0,0,640,.42],[0,0,760,.18]].map(([x,y,sz,op],i)=>{const sp=new T.Sprite(new T.SpriteMaterial(addMat({map:glow,opacity:op,fog:false})));sp.position.set(x,y,-80);sp.scale.set(sz,sz*.85,1);sp.userData={op,i};return add(sp);});
  // ---- grid floor + ceiling (parallel lines converge by real perspective)
  // endless space-time grid: rebuilt around the camera every frame, faded with distance so it has no edges
  const EXT3=12000,MAXR=Math.ceil(2*EXT3/RAY)+2,MAXROW=Math.ceil(2*EXT3/ROW)+2;
  function plane(sg,col,op){return{rays:fat(MAXR*60),rows:fat(MAXROW*60),sg,col,op};}
  const floor=plane(1,C.pink,.75),ceil=plane(-1,C.a,.5);
  // ---- sphere wireframe: front lines take the pole of their side, back lines stay faint, rim split cyan / magenta
  const sph=new T.Group();add(sph);const R=265,sv=[];
  circles.forEach(c=>{for(let s=0;s<40;s++){const a=c.pts[s],b=c.pts[s+1];sv.push([a[0]*R,-a[1]*R,a[2]*R,b[0]*R,-b[1]*R,b[2]*R]);}});
  const sphGlow=fat(sv.length),sphCore=fat(sv.length);
  const RIM=72,rimGlow=fat(RIM),rimCore=fat(RIM);
  const shell=add(new T.Sprite(new T.SpriteMaterial(addMat({map:glow,opacity:.18,color:hx(C.violet),fog:false}))));shell.scale.set(760,760,1);
  const vA=new T.Vector3(),vB=new T.Vector3(),camR=new T.Vector3(),camU=new T.Vector3();
  // ---- orbit rings
  const orbits=[[84,360,1.2,-.22,.35],[56,318,-1.05,.4,-.5]].map(([n,rr,tilt,tz,spd],oi)=>{const g=new T.BufferGeometry();g.setAttribute("position",new T.BufferAttribute(new Float32Array(n*3),3));g.setAttribute("color",new T.BufferAttribute(new Float32Array(n*3),3));
    add(new T.Points(g,new T.PointsMaterial(addMat({size:16,map:glow,vertexColors:true}))));return{n,rr,tilt,tz,spd,g,oi};});
  // ---- nebula bokeh as a volume inside the orb
  const bok=bokeh.map(b=>{const sp=new T.Sprite(new T.SpriteMaterial(addMat({map:glow,color:hx(b.c),opacity:b.op*.85})));const zm=Math.sqrt(Math.max(0,270*270-(b.x/1.1)*(b.x/1.1)-b.y*b.y));sp.userData={b,z:rnd(-zm,zm)};sp.scale.setScalar(b.r*3.4);return add(sp);});
  // ---- neural mesh: nodes get real depth; edges and nodes built like the 2D strokes (glow + core + ring)
  nodes.forEach(n=>{n.z3=n.layer<0?0:n.layer===3?rnd(-60,60):rnd(-280,280)*(1-n.layer*.18);});
  const edgeGlow=fat(edges.length),edgeCore=fat(edges.length);
  const ng=new T.BufferGeometry();ng.setAttribute("position",new T.BufferAttribute(new Float32Array(nodes.length*3),3));ng.setAttribute("color",new T.BufferAttribute(new Float32Array(nodes.length*3),3));
  const nodeBloom=nodes.map(n=>n.layer<0?null:add(new T.Sprite(new T.SpriteMaterial(addMat({map:glow,color:hx(C.a),opacity:1})))));
  add(new T.Points(ng,new T.PointsMaterial(addMat({size:24,map:ringTex,vertexColors:true}))));
  add(new T.Points(ng,new T.PointsMaterial(addMat({size:11,map:glow,color:hx(C.eye)}))));
  const pg=new T.BufferGeometry();pg.setAttribute("position",new T.BufferAttribute(new Float32Array(pulses.length*3),3));
  add(new T.Points(pg,new T.PointsMaterial(addMat({size:34,map:glow,color:hx(C.eye)}))));
  const trailL=fat(pulses.length);
  // ---- lightning lens: outer glow, mid glow, white core, like the 2D stack
  const lens=strands.map(st=>({st,outer:fat(90),mid:fat(90),core:fat(90,{color:C.eye})}));
  // ---- deep-space particles: a wide field that streams sideways with the travel (parallax comes from real depth)
  const SN=1400,sPos=new Float32Array(SN*3),sCol=new Float32Array(SN*3),sBase=[];
  for(let i=0;i<SN;i++){const x=rnd(-9000,9000),y=rnd(-2600,2600),z=rnd(-14000,1200);sBase.push([x,y,z,rnd(0,900)]);col3(sCol,i*3,C.nebula[(Math.random()*8)|0],rnd(.35,1));}
  const sg2=new T.BufferGeometry();sg2.setAttribute("position",new T.BufferAttribute(sPos,3));sg2.setAttribute("color",new T.BufferAttribute(sCol,3));
  add(new T.Points(sg2,new T.PointsMaterial(addMat({size:26,map:glow,vertexColors:true}))));
  // ---- embers rising off the floor (2D port)
  const EN=160,ePos=new Float32Array(EN*3),eCol=new Float32Array(EN*3),emb=[];
  const eg3=new T.BufferGeometry();eg3.setAttribute("position",new T.BufferAttribute(ePos,3));eg3.setAttribute("color",new T.BufferAttribute(eCol,3));
  add(new T.Points(eg3,new T.PointsMaterial(addMat({size:14,map:glow,vertexColors:true}))));
  const spawnEmber=e=>{e.x=rnd(-5000,5000);e.z=rnd(-5000,1400);e.y=-GAP-well3(e.x,e.z);e.vy=rnd(60,170);e.age=0;e.life=rnd(4,9);e.c=Math.random()<.7?C.pink:C.eye;};
  for(let i=0;i<EN;i++){const e={};spawnEmber(e);e.age=rnd(0,e.life);emb.push(e);}
  // ---- motes spiraling in from all directions
  const MN=340,mp=new Float32Array(MN*3),mcol=new Float32Array(MN*3),mst=[];const mg=new T.BufferGeometry();mg.setAttribute("position",new T.BufferAttribute(mp,3));mg.setAttribute("color",new T.BufferAttribute(mcol,3));
  add(new T.Points(mg,new T.PointsMaterial(addMat({size:9,map:glow,vertexColors:true}))));
  const respawn=m=>{const u=rnd(-1,1),th=rnd(0,TAU),r=rnd(900,2400),q=Math.sqrt(1-u*u);m.p=[r*q*Math.cos(th),r*u*.6,r*q*Math.sin(th)];m.c=[C.a,C.b,C.eye][(Math.random()*3)|0];};
  for(let i=0;i<MN;i++){const m={};respawn(m);mst.push(m);}
  // ---- fx (share the 2D simulation, mapped onto the orb's plane)
  const spg=new T.BufferGeometry();spg.setAttribute("position",new T.BufferAttribute(new Float32Array(sparks.length*3),3));spg.setAttribute("color",new T.BufferAttribute(new Float32Array(sparks.length*3),3));
  add(new T.Points(spg,new T.PointsMaterial(addMat({size:12,map:glow,vertexColors:true}))));
  const fl=flashes.map(()=>add(new T.Sprite(new T.SpriteMaterial(addMat({map:glow,color:hx(C.eye),opacity:0})))));
  const boltGlow=fat(bolts.length*80),boltCore=fat(bolts.length*80);
  const ringL=fat(rings.length*48);
  // ---- the face decal
  const FS=/iPhone|iPad|Android|Mobi/.test(navigator.userAgent)?768:1024,fc=document.createElement("canvas");fc.width=fc.height=FS;const fctx=fc.getContext("2d");
  const ftex=new T.CanvasTexture(fc);ftex.minFilter=T.LinearFilter;
  const face=add(new T.Mesh(new T.PlaneGeometry(820*.7,820*.7),new T.MeshBasicMaterial({map:ftex,transparent:true,depthWrite:false,fog:false,side:T.DoubleSide})));face.renderOrder=10;

  let tv=Math.tan(21*Math.PI/180),dist=1800,vw=1,vh=1;
  T3.resize=()=>{const r=c3.getBoundingClientRect();vw=Math.max(1,r.width);vh=Math.max(1,r.height);renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,dprCap,2.5));renderer.setSize(vw,vh,false);cam3.aspect=vw/vh;cam3.updateProjectionMatrix();
    if(FAT)fats.forEach(o=>o.m.resolution.set(vw,vh));};
  T3.toWorld=(px,py)=>{const r=c3.getBoundingClientRect(),ppu=r.height/(2*dist*tv),m=T3.flip<0?-1:1;return{x:800+m*(px-r.width/2)/ppu,y:450+(py-r.height/2)/ppu};};
  T3.fat=FAT;
  on(window,"resize",()=>{if(mode==="3d")T3.resize();});

  T3.frame=dt=>{
    // camera: slow autonomous drift + your orbit
    const a=cam3.aspect,fit=Math.max(640/tv,(a<1?560:1000)/(tv*a));dist=fit*T3.zoom;
    const az=.32*Math.sin(time*.06)+T3.uaz,el=.02+.04*Math.sin(time*.045)+T3.uel;
    cam3.position.set(dist*Math.sin(az)*Math.cos(el),dist*Math.sin(el),dist*Math.cos(az)*Math.cos(el));cam3.lookAt(0,0,0);cam3.updateMatrixWorld();
    camR.setFromMatrixColumn(cam3.matrixWorld,0);camU.setFromMatrixColumn(cam3.matrixWorld,1);
    const ppu=vh/(2*dist*tv),dim=sty.dim,W3=px=>Math.max(1,px*ppu); // world-unit stroke widths -> screen pixels, same as 2D
    // haze follows the poles
    haze[0].material.color.set(poleL);haze[1].material.color.set(poleR);haze[2].material.color.set(C.violet);haze[3].material.color.set(C.violet);
    haze.forEach(h=>{h.material.opacity=h.userData.op*dim*(.8+.3*noise(time*.3+h.userData.i)+energy*.4+heart*.25);});
    // grid rows scroll toward the camera
    // endless grid around the camera: rays slide right-to-left with the travel, both planes pushed away by the entity
    const cx=cam3.position.x,cz=cam3.position.z,off=((travel%RAY)+RAY)%RAY;
    const xs=[];for(let x=Math.floor((cx-EXT3)/RAY)*RAY;x<=cx+EXT3;x+=RAY)xs.push(x-off);
    const zs=[];for(let z=Math.floor((cz-EXT3)/ROW)*ROW;z<=cz+EXT3;z+=ROW)zs.push(z);
    const zB=breaks(cz-EXT3,cz+EXT3,-2600,2600,160,1100),xB=breaks(cx-EXT3,cx+EXT3,GW.x3-2600,GW.x3+2600,140,1100);
    for(const P of [floor,ceil]){const yA=(x,z)=>P.sg>0?-GAP-well3(x,z):GAP+well3(x,z),c=hx(P.col);
      const put=(o,k,x0,z0,x1,z1)=>{seg(o,k,x0,yA(x0,z0),z0,x1,yA(x1,z1),z1);const d=Math.hypot((x0+x1)/2-cx,(z0+z1)/2-cz),f=fadeK(d)*P.op*dim,p=o.col,j=k*6;p[j]=p[j+3]=c.r*f;p[j+1]=p[j+4]=c.g*f;p[j+2]=p[j+5]=c.b*f;};
      let k=0;for(const x of xs)for(let j=0;j<zB.length-1;j++)put(P.rays,k++,x,zB[j],x,zB[j+1]);P.rays.commit(k);
      k=0;for(const z of zs)for(let j=0;j<xB.length-1;j++)put(P.rows,k++,xB[j],z,xB[j+1],z);P.rows.commit(k);
      P.rays.width(1.6);P.rows.width(1.6);}
    // sphere: front segments colored by world side, back segments faint white
    sph.rotation.set(sphRot.pitch,sphRot.yaw,sphRot.roll,"XYZ");sph.updateMatrixWorld();
    const gl=Math.min(1,.55+energy*.4+heart*.2)*dim,sideSign=T3.flip<0?-1:1;
    for(let i=0;i<sv.length;i++){const q=sv[i];vA.set(q[0],q[1],q[2]).applyMatrix4(sph.matrixWorld);vB.set(q[3],q[4],q[5]).applyMatrix4(sph.matrixWorld);
      seg(sphCore,i,vA.x,vA.y,vA.z,vB.x,vB.y,vB.z);seg(sphGlow,i,vA.x,vA.y,vA.z,vB.x,vB.y,vB.z);
      const front=vA.dot(cam3.position)>0&&vB.dot(cam3.position)>0,c=(vA.x+vB.x)<0?poleL:poleR;
      if(front){scol(sphCore,i,c,gl);scol(sphGlow,i,c,.2*gl);}else{scol(sphCore,i,C.eye,.16*dim);scol(sphGlow,i,C.eye,0);}}
    sphCore.commit(sv.length);sphGlow.commit(sv.length);sphCore.width(W3(1.8));sphGlow.width(W3(7));
    // rim: camera-facing circle, left half pole L and right half pole R (mirrors with the face)
    for(let i=0;i<RIM;i++){const a0=i/RIM*TAU,a1=(i+1)/RIM*TAU,ax=Math.cos(a0)*R,ay=Math.sin(a0)*R,bx=Math.cos(a1)*R,by=Math.sin(a1)*R;
      const P=(x,y)=>[camR.x*x+camU.x*y,camR.y*x+camU.y*y,camR.z*x+camU.z*y],A=P(ax,ay),B=P(bx,by);
      seg(rimCore,i,A[0],A[1],A[2],B[0],B[1],B[2]);seg(rimGlow,i,A[0],A[1],A[2],B[0],B[1],B[2]);
      const c=((ax+bx)*sideSign)<0?poleL:poleR;scol(rimCore,i,c,.85*gl);scol(rimGlow,i,c,.3*gl);}
    rimCore.commit(RIM);rimGlow.commit(RIM);rimCore.width(W3(2.2));rimGlow.width(W3(10));
    shell.material.opacity=(.12+heart*.08)*dim;
    // orbits
    for(const o of orbits){const tilt=o.tilt+.08*fbm(time*.1+o.rr),tz=o.tz+.1*fbm(time*.08+o.rr+7),ct=Math.cos(tilt),st=Math.sin(tilt),cz=Math.cos(tz),sz=Math.sin(tz),P=o.g.attributes.position.array,Cc=o.g.attributes.color.array;
      for(let i=0;i<o.n;i++){const an=i/o.n*TAU+orbitAng*o.spd,x=Math.cos(an),z=Math.sin(an),y2=-z*st,z2=z*ct,x3=x*cz-y2*sz,y3=x*sz+y2*cz;P[i*3]=o.rr*x3;P[i*3+1]=-o.rr*y3;P[i*3+2]=o.rr*z2;
        const facing3=(P[i*3]*cam3.position.x+P[i*3+1]*cam3.position.y+P[i*3+2]*cam3.position.z)>0;col3(Cc,i*3,o.oi?(i%2?C.eye:C.violet):(i%2?poleR:poleL),(facing3?.95:.18)*dim);}
      o.g.attributes.position.needsUpdate=true;o.g.attributes.color.needsUpdate=true;}
    // bokeh drift
    for(const sp of bok){const b=sp.userData.b;sp.position.set(b.x+24*fbm(time*.12+b.s),-(b.y+24*fbm(time*.1+b.s+200)),sp.userData.z+20*fbm(time*.09+b.s+400));sp.material.opacity=b.op*(.55+.45*noise(time*.7+b.s))*(1+energy*.5)*dim;}
    // mesh edges: glow + core, hot edges flare toward white
    edges.forEach((e,i)=>{const A=e.a,B=e.b,ax=spreadX(A.x),ay=-A.y,az=A.z3,bx=spreadX(B.x),by=-B.y,bz=B.z3;seg(edgeCore,i,ax,ay,az,bx,by,bz);seg(edgeGlow,i,ax,ay,az,bx,by,bz);
      const h=Math.max(A.hot,B.hot),c=A.side<0?poleL:poleR;scol(edgeGlow,i,c,(.16+h*.35)*dim);
      const cc=hx(c),k=(.6+energy*.2)*dim,w=h>.25?h*.9:0,p=edgeCore.col,j=i*6;p[j]=p[j+3]=Math.min(1,cc.r*k+w);p[j+1]=p[j+4]=Math.min(1,cc.g*k+w);p[j+2]=p[j+5]=Math.min(1,cc.b*k+w);});
    edgeCore.commit(edges.length);edgeGlow.commit(edges.length);edgeCore.width(W3(1.8));edgeGlow.width(W3(7));
    const NP=ng.attributes.position.array,NC=ng.attributes.color.array;
    nodes.forEach((n,i)=>{NP.set(n.layer<0?[0,-99999,0]:[spreadX(n.x),-n.y,n.z3],i*3);col3(NC,i*3,n.side<0?poleL:poleR,(.6+n.hot)*dim);
      const sp=nodeBloom[i];if(sp){const r=n.layer===0?7:n.layer<3?6:5,rad=r*(3+.9*noise(time*1.3+n.s)+n.hot*3);sp.position.set(spreadX(n.x),-n.y,n.z3);sp.scale.set(rad*2.6,rad*2.6,1);sp.material.color.set(n.side<0?poleL:poleR);sp.material.opacity=(.85+n.hot*.4)*dim;}});
    ng.attributes.position.needsUpdate=true;ng.attributes.color.needsUpdate=true;
    const PP=pg.attributes.position.array;
    let tk=0;
    pulses.forEach((p,i)=>{if(!p.on||p.x===undefined){PP.set([0,-99999,0],i*3);return;}const q=to3(p.x,p.y),z=lerp(p.a.z3||0,p.b.z3||0,p.t);PP.set([q[0],q[1],z],i*3);
      const ax=spreadX(p.a.x),ay=-p.a.y,az=p.a.z3||0,bx=spreadX(p.b.x),by=-p.b.y,bz=p.b.z3||0,L=Math.hypot(bx-ax,by-ay,bz-az)||1,t0=Math.max(0,p.t-36/L);
      seg(trailL,tk,lerp(ax,bx,t0),lerp(ay,by,t0),lerp(az,bz,t0),lerp(ax,bx,p.t),lerp(ay,by,p.t),lerp(az,bz,p.t));scol(trailL,tk,p.a.side<0?poleL:poleR,.85*dim);tk++;});
    pg.attributes.position.needsUpdate=true;trailL.commit(tk);trailL.width(W3(3.5));
    // lens: same three-stroke stack as 2D
    for(const L of lens){const pts=L.st.pts||[],n=Math.min(91,pts.length/2),c=L.st.sg<0?poleL:poleR;let prev=null,k=0;
      for(let i=0;i<n;i++){const q=to3(pts[i*2],pts[i*2+1]),z=Math.sin(Math.PI*i/90)*60*L.st.sg;
        if(prev){seg(L.outer,k,prev[0],prev[1],prev[2],q[0],q[1],z);seg(L.mid,k,prev[0],prev[1],prev[2],q[0],q[1],z);seg(L.core,k,prev[0],prev[1],prev[2],q[0],q[1],z);scol(L.outer,k,c,.2*dim);scol(L.mid,k,c,.45*dim);k++;}
        prev=[q[0],q[1],z];}
      L.outer.commit(k);L.mid.commit(k);L.core.commit(k);L.core.m.opacity=dim;
      L.outer.width(W3(L.st.w*5));L.mid.width(W3(L.st.w*2.2));L.core.width(W3(L.st.w));}
    // embers
    for(let i=0;i<EN;i++){const e=emb[i];e.age+=dt;e.y+=e.vy*(1+energy)*dt;e.x-=(travel-(T3.lastTravel||travel))+22*fbm(time*.3+i)*dt;
      if(e.age>e.life||e.y>-40||e.x<-6000)spawnEmber(e);const f=Math.min(1,e.age*2)*Math.min(1,(-40-e.y)/180)*(.4+.6*noise(time*4+i));
      ePos[i*3]=e.x;ePos[i*3+1]=e.y;ePos[i*3+2]=e.z;col3(eCol,i*3,e.c,Math.max(0,f)*.85*dim);}
    eg3.attributes.position.needsUpdate=true;eg3.attributes.color.needsUpdate=true;T3.lastTravel=travel;
    // starfield streams right-to-left with the travel, wrapping around
    for(let i=0;i<SN;i++){const b=sBase[i];let x=b[0]-travel*1.0;x=((x+9000)%18000+18000)%18000-9000;sPos[i*3]=x;sPos[i*3+1]=b[1];sPos[i*3+2]=b[2];}
    sg2.attributes.position.needsUpdate=true;
    // motes: pulled in and swirled, stronger when excited
    const pull=(120+energy*260)*(sty.grav>20?.6:1);
    for(let i=0;i<MN;i++){const m=mst[i],p=m.p,d=Math.hypot(p[0],p[1],p[2])||1;
      if(d<250){respawn(m);continue;}
      const tx=-p[2]/d,tz=p[0]/d;p[0]+=(-p[0]/d*pull+tx*pull*.8-120)*dt;p[1]+=(-p[1]/d*pull-sty.grav*2.5)*dt;p[2]+=(-p[2]/d*pull+tz*pull*.8)*dt;
      mp.set(p,i*3);col3(mcol,i*3,m.c,clamp((2600-d)/900,0,1)*.8*dim);}
    mg.attributes.position.needsUpdate=true;mg.attributes.color.needsUpdate=true;
    // fx
    const SP=spg.attributes.position.array,SC=spg.attributes.color.array;
    sparks.forEach((s,i)=>{if(s.life<=0||s.x===undefined){SP.set([0,-99999,0],i*3);return;}const q=to3(s.x,s.y);SP.set([q[0],q[1],0],i*3);col3(SC,i*3,s.c||C.eye,s.k||0);});
    spg.attributes.position.needsUpdate=true;spg.attributes.color.needsUpdate=true;
    flashes.forEach((f,i)=>{const sp=fl[i];if(f.life<=0){sp.material.opacity=0;return;}const q=to3(f.x,f.y),p=f.p||0,sz=(24+140*p)*f.size;sp.position.set(q[0],q[1],10);sp.scale.set(sz,sz,1);sp.material.opacity=(1-p)*(1-p);});
    let bk=0;
    bolts.forEach(b=>{if(b.life<=0||!b.pts)return;const n=Math.min(80,b.pts.length),k=b.k||0;
      for(let j=1;j<n;j++){const A=to3(b.pts[j-1][0],b.pts[j-1][1]),B=to3(b.pts[j][0],b.pts[j][1]);seg(boltCore,bk,A[0],A[1],0,B[0],B[1],0);seg(boltGlow,bk,A[0],A[1],0,B[0],B[1],0);scol(boltCore,bk,C.eye,k);scol(boltGlow,bk,b.col,.4*k);bk++;}});
    boltCore.commit(bk);boltGlow.commit(bk);boltCore.width(W3(2.2));boltGlow.width(W3(9));
    let rk=0;
    rings.forEach(r=>{if(r.life<=0)return;const q=to3(r.x,r.y),p=r.p||0,sz=(20+300*p)*r.size,k=(1-p)*(1-p)*.9;
      for(let i=0;i<48;i++){const a0=i/48*TAU,a1=(i+1)/48*TAU,x0=Math.cos(a0)*sz,y0=Math.sin(a0)*sz*.62,x1=Math.cos(a1)*sz,y1=Math.sin(a1)*sz*.62;
        seg(ringL,rk,q[0]+camR.x*x0+camU.x*y0,q[1]+camR.y*x0+camU.y*y0,camR.z*x0+camU.z*y0,q[0]+camR.x*x1+camU.x*y1,q[1]+camR.y*x1+camU.y*y1,camR.z*x1+camU.z*y1);scol(ringL,rk,r.col,k);rk++;}});
    ringL.commit(rk);ringL.width(W3(3));
    // face decal: same rig, same occlusion rules, always facing the camera, mirrored from behind
    const G=faceGeom(),B=faceBody(),k=FS/820;ctx=fctx;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,FS,FS);
    ctx.translate(FS/2,FS/2);ctx.rotate((head.tilt.v+moodFx.tilt)*Math.PI/180);ctx.translate(0,B.y/.7*k);ctx.scale(k*B.sx,k*B.sy);renderFaceCore(G.g);ctx=ctx2d;
    ftex.needsUpdate=true;face.quaternion.copy(cam3.quaternion);
    const facing=Math.cos(az)>=0?1:-1;T3.flip+=(facing-T3.flip)*(1-Math.pow(.0004,dt));face.scale.set(T3.flip,1,1);
    renderer.render(scene,cam3);
  };
}

// ============================================================ main loop with adaptive quality
let quality=1,emaDt=1/60,slowT=0;
function frame(now){
  rafId=0;if(disposed||paused)return;
  if(last===null)last=now;const raw=(now-last)/1000;let dt=Math.min(.05,raw);last=now;if(reduce)dt*=.4;time+=dt;
  // 30 fps caps (iOS Low Power Mode, ProMotion off) are steady and fine: only react below ~22 fps, after boot settles.
  // Thin particles first; lower resolution only as a last resort and never below 2x on high-density screens.
  if(raw>0&&raw<.5&&time>3){emaDt=emaDt*.95+raw*.05;if(emaDt>.045){slowT+=raw;if(slowT>2){slowT=0;
    if(quality>.5)quality=Math.max(.5,quality-.15);
    else{const floor=Math.min(window.devicePixelRatio||1,2);if(dprCap>floor+.01){dprCap=Math.max(floor,dprCap-.5);resize();}}}}else slowT=0;}
  stepStyle(dt);wellStep();ltime+=dt*sty.tempo;travel+=dt*420*(1+energy*.8)*(boot.done?1:seg(boot.t,.5,3));orbitAng+=dt*(sty.orbit+energy*1.5);
  energy=Math.max(sty.energy,energy-dt*.45);
  bootStep(dt);bootUI();if(boot.done&&mode==="2d"){E.s+=(finalS()-E.s)*(1-Math.pow(.05,dt));}autoTick();updateEyes(dt);stepSprings(dt);heartbeat(dt);events(dt);
  if(mode==="3d"&&T3.ready){
    E.x=800;E.y=450;E.s=1;E.w=1;
    drawMesh(dt,false);drawSphere(dt,false);drawLens(dt,false);drawPulses(dt,false);drawFx(dt,false);
    T3.frame(dt);
  }else{
    ctx=ctx2d;ctx.setTransform(DPR,0,0,DPR,0,0);drawBackground();drawGrid(dt);
    ctx.setTransform(DPR*cam.s,0,0,DPR*cam.s,DPR*cam.ox,DPR*cam.oy);
    ctx.globalCompositeOperation="lighter";
    drawStars(dt);drawHaze();drawMotes(dt);drawMesh(dt,true);drawBokeh();drawSphere(dt,true);drawLens(dt,true);drawPulses(dt,true);drawOrbits();drawFx(dt,true);
    ctx.globalCompositeOperation="source-over";drawFace();
  }
  rafId=requestAnimationFrame(frame);
}
on(window,"resize",resize);on(window,"orientationchange",()=>setTimeout(resize,250));
if(typeof ResizeObserver!=="undefined"){ro=new ResizeObserver(()=>{resize();if(mode==="3d"&&T3.ready)T3.resize();});ro.observe(host);}
resize();setExpr("calm");rafId=requestAnimationFrame(frame);
// ============================================================ moods (the SVG rig's state machine, layered on the alive rig)
// Idle -> Ponder -> Process (70%) -> Insight (60%) -> Idle ; Ponder -> Idle (30%) ; Process -> Ponder (40%)
// Idle/Ponder -> Curious while the pointer is active; Curious can interrupt anything but Insight.
// Spec: RaBbLE-Aether/RaBbLE-Entity-Visual-Spec.md "Reconciled mood + Aether-state model".
function enterMood(name, hold) {
  if (!MOOD_FX[name]) return false;
  moodS.name = name; moodS.since = time; moodS.fx1 = moodS.fx2 = 0;
  const d = MOOD_DUR[name];
  moodS.next = d ? time + rnd(d[0], d[1]) : Infinity;
  moodS.until = hold == null ? 0 : time + hold;
  if (name === 'ponder') moodFx.side = Math.random() < .5 ? -1 : 1;
  emitState();
  return true;
}
function moodStep(dt) {
  const tgt = MOOD_FX[moodS.name], k = 1 - Math.pow(.02, dt);
  const side = moodS.name === 'ponder' ? moodFx.side : 1;
  let tilt = tgt.tilt * side;
  const active = pointer.active && time - pointer.t < 2.5 && pointer.wx !== null;
  if (moodS.name === 'curious' && active) tilt = clamp((pointer.wx - E.x) / Math.max(.3, E.s) * .012, -6, 6);
  for (const key of ['squint', 'dart', 'pulse', 'spin']) moodFx[key] += (tgt[key] - moodFx[key]) * k;
  moodFx.gx += (tgt.gx * side - moodFx.gx) * k; moodFx.gy += (tgt.gy - moodFx.gy) * k; moodFx.tilt += (tilt - moodFx.tilt) * k;
  if (!boot.done) return;
  if (moodS.name === 'process') energy = Math.max(energy, .25);
  if (moodS.name === 'insight') {
    const t = time - moodS.since;
    if (!moodS.fx1) { moodS.fx1 = 1; eye.widen = 1; flash(E.x, E.y, 2.2); ring(E.x, E.y, poleL, 1.6); ring(E.x, E.y, poleR, 1.2);
      bolt('to', E.x - 900 * E.s, E.y); bolt('to', E.x + 900 * E.s, E.y); energy = Math.min(1, energy + .4); }
    if (!moodS.fx2 && t > 1.3) { moodS.fx2 = 1; startBlink(true); }
  }
  // a host-held mood blocks the machine until its hold expires (hold Infinity = until the host changes it)
  if (moodS.until && time < moodS.until) return;
  if (moodS.until && time >= moodS.until) { moodS.until = 0; enterMood('idle'); return; }
  if (moodS.name === 'insight' && time > moodS.next) { enterMood('idle'); return; }
  if (!moodS.auto) return;
  if (active && moodS.name !== 'insight' && moodS.name !== 'curious') { enterMood('curious'); return; }
  if (moodS.name === 'curious') { if (!active) enterMood('idle'); return; }
  if (stateS !== 'idle' || time < moodS.next) return;
  const r = Math.random();
  if (moodS.name === 'idle') enterMood('ponder');
  else if (moodS.name === 'ponder') enterMood(r < .7 ? 'process' : 'idle');
  else if (moodS.name === 'process') enterMood(r < .6 ? 'insight' : 'ponder');
}

// ============================================================ Aether states: idle | listening | speaking (portal flip)
function setState(s) {
  if (s === 'thinking') { setState('idle'); enterMood('process', Infinity); return; }
  if (!ALIVE_STATES.includes(s) || s === stateS) return;
  stateS = s;
  if (s === 'listening') { mind.listening = true; mind.talkT = -1; setExpr('listening'); }
  else if (s === 'speaking') { mind.listening = false; mind.talkT = 0; setExpr('speaking'); }
  else { mind.listening = false; mind.talkT = -1; setExpr(emotion === 'angry' ? 'calm' : emotion); mind.next = time + 3; }
  interact();
  emitState();
}
function setEmotion(name, hold = 8) {
  if (!STYLE[name]) return;
  if (stateS !== 'idle') { emotion = name; styT = STYLE[name]; emitState(); return; } // keep the listening/speaking pose
  setExpr(name, name === 'calm' ? 0 : hold);
  mind.manualUntil = time + (name === 'calm' ? 0 : hold);
  mind.lonely = false;
}
function toColor(v) {
  if (!v) return null;
  if (PAL[v]) return PAL[v];
  const hex = String(v).toLowerCase();
  return Object.values(PAL).includes(hex) ? hex : null; // canonical palette values only
}

// ============================================================ public API (the <rabble-entity backend="alive"> contract)
if (opts.portalA || opts.portalB) { const a = toColor(opts.portalA) || poleL, b = toColor(opts.portalB) || poleR; if (a !== b) { poleL = a; poleR = b; } }
if (opts.autoboot) startBoot([]);

const api = {
  name: 'alive',
  /** Run the boot. steps: [{id,label}] the host settles with completeStep/failStep. Resolves when boot completes. */
  boot(o = {}) { return startBoot(o.steps || []); },
  completeStep(id) { return settleStep(id, true); },
  failStep(id, reason) { return settleStep(id, false, reason); },
  /** Fast-forward the visuals (never past a pending hold). */
  skip() { skipBoot(); },
  setState,
  setMood(name, o = {}) { const hold = o.hold != null ? o.hold : name === 'insight' ? null : Infinity; if (name === 'idle' && o.hold == null) { enterMood('idle'); return; } enterMood(name, hold); },
  setEmotion(name, o = {}) { setEmotion(name, o.hold != null ? o.hold : 8); },
  /** Recolor the two poles (palette names like 'cyan' or canonical hexes). The poles must differ. */
  setPortals(a, b) { const A = toColor(a), B = toColor(b); if (!A || !B || A === B) return false; poleL = A; poleR = B; emit('entity-portals', { a: A, b: B }); return true; },
  getPortals() { return { a: poleL, b: poleR }; },
  pulse(kind = 'spark') {
    if (!boot.done) return;
    if (kind === 'bolt') bolt('in');
    else if (kind === 'ring') { ring(E.x, E.y, poleL, 1.4); ring(E.x, E.y, poleR, 1.1); }
    else if (kind === 'flash') flash(E.x, E.y, 1.6);
    else if (kind === 'shock') { ring(E.x, E.y, poleL, 2.4); ring(E.x, E.y, poleR, 1.7); flash(E.x, E.y, 3.2); energy = 1; eye.widen = 1; }
    else { const k = E.s * .7; spawnSpark(E.x - 92 * k, E.y - 126 * k, 10, poleL); spawnSpark(E.x + 92 * k, E.y + 126 * k, 10, poleR); }
  },
  /** Glance at a viewport point (clientX/clientY), e.g. the chat input. */
  attend(x, y, dur = .9) { const r = cv.getBoundingClientRect(), w = toWorld(x - r.left, y - r.top); eye.attn = { x: w.x, y: w.y, until: time + dur }; },
  setDimension(d) { if (d === '3d' || d === '2d') setMode(d); },
  get dimension() { return mode; },
  pause() { if (paused) return; paused = true; if (rafId) cancelAnimationFrame(rafId); rafId = 0; },
  resume() { if (!paused || disposed) return; paused = false; last = null; rafId = requestAnimationFrame(frame); },
  resize() { resize(); if (mode === '3d' && T3.ready) T3.resize(); },
  dispose() {
    if (disposed) return; disposed = true;
    if (rafId) cancelAnimationFrame(rafId);
    listeners.forEach(([t, ev, fn, o]) => t.removeEventListener(ev, fn, o)); listeners.length = 0;
    if (ro) ro.disconnect();
    if (T3.renderer) { T3.renderer.dispose(); if (T3.renderer.forceContextLoss) T3.renderer.forceContextLoss(); }
    stage.remove();
  },
  getSnapshot() {
    return { backend: 'alive', state: stateS, mood: moodS.name, emotion, dimension: mode, energy,
      boot: { started: !boot.dormant, t: boot.t, holding: boot.holding, ready: boot.readyFired, done: boot.done,
        steps: steps.map(s => ({ id: s.id, settled: s.settled, ok: s.ok })) },
      portals: { a: poleL, b: poleR }, quality };
  },
  // ---- legacy <rabble-entity> surface (Canvas2dBackend / ThreeJsBackend callers)
  setEntityState(s) { setState(s === 'thinking' ? 'thinking' : s); if (s === 'idle' && moodS.name === 'process' && moodS.until === Infinity) enterMood('idle'); },
  triggerBoot() { return startBoot([]); },
  injectEyeJolt(dx, dy) { eye.vx += (dx || 0) * 40; eye.vy += (dy || 0) * 40; },
  setEntropy(v) { energy = clamp(+v || 0, 0, 1); },
  setEyeConfig() {}, setParticleConfig() {}, setPortalVisible() {},
};
return api;
}
