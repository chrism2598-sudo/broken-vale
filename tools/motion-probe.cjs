// Running-jitter probe (phone conditions). Phone portrait 390×844, Lite, touch emulation, CPU throttled ×5 via CDP.
// A) simFrames: the real frame path (fixed step + interpolation, or the M11 path with ?legacy) driven by injected phone frame
//    times (60 Hz with jitter, 30 Hz stretches, 50–100 ms spikes; callback-start latency noise on the measured dt) and a noisy
//    touch stick (±6° angle noise, 0.93–1 magnitude) — 10 s straight run and 10 s curving run, before (legacy) vs after.
// B) real touch joystick on the throttled page (sanity; headless renders ~1–2 fps so it can't show phone timing).
// Usage: node tools/motion-probe.cjs
const puppeteer=require(process.env.PUPPETEER_CORE||'puppeteer-core');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const W=390,H=844;let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};const gauss=()=>{let s=0;for(let i=0;i<6;i++)s+=rnd();return (s-3)/Math.sqrt(0.5);};
function phoneFrames(sec,curve){const f=[];let t=0,e0=0,i=0;while(t<sec){let d=1/60*(1+0.08*gauss());if(Math.floor(t/2.5)%2===1&&rnd()<0.6)d=1/30;if(rnd()<0.012)d=0.05+rnd()*0.05;d=Math.max(0.008,d);
  const e=Math.abs(gauss())*0.003;const md=Math.max(0.001,d+e-e0);e0=e;t+=d;i++;
  const base=curve?(-Math.PI/2+0.45*Math.sin(t*0.9)):-Math.PI/2;const ang=base+(gauss()*6*Math.PI/180);const m=0.93+0.07*rnd();f.push([d,md,Math.cos(ang)*m,Math.sin(ang)*m]);}return f;}
const sd=a=>{const m=a.reduce((s,x)=>s+x,0)/a.length;return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/a.length);};const rms=a=>Math.sqrt(a.reduce((s,x)=>s+x*x,0)/a.length);
function revs(a,th){let n=0,last=0;for(let i=1;i<a.length;i++){const d=a[i]-a[i-1];const dd=Math.atan2(Math.sin(d),Math.cos(d));if(Math.abs(dd)>th){if(last&&Math.sign(dd)!==Math.sign(last))n++;last=dd;}}return n;}
function metrics(R){ // [t,dt,px,pz,hx,hz,cx,cy,cz,dist,sx,sy,speed,heading,yaw,camRotY]
  const r=R.filter(x=>x[12]>4.5);if(r.length<20)return {n:r.length};
  const lat=[],scroll=[],sj=[];for(let i=0;i<r.length;i++){const x=r[i];const ry=x[14];const rx=Math.cos(ry),rz=-Math.sin(ry);lat.push((x[2]-x[6])*rx+(x[3]-x[8])*rz);
    if(i){const a=r[i-1];const mv=Math.hypot(x[6]-a[6],x[8]-a[8]);const exp=x[12]*x[1];scroll.push(mv/exp-1);sj.push(Math.hypot((x[10]-a[10])*W/2,(x[11]-a[11])*H/2));}}
  const lv=[];for(let i=1;i<r.length;i++){const x=r[i],a=r[i-1];const ry=x[14];lv.push(((x[6]-a[6])*Math.cos(ry)+(x[8]-a[8])*-Math.sin(ry))/x[1]);}
  const hd=r.map(x=>x[13]);const hs=[];for(let i=2;i<hd.length-2;i++){const m=(hd[i-2]+hd[i-1]+hd[i+1]+hd[i+2])/4;hs.push(hd[i]-m);}
  return {frames:r.length,camYawReversals:revs(r.map(x=>x[15]),0.0015),headingReversals:revs(r.map(x=>x[13]),0.002),lateralOffsetSdCm:+(sd(lat)*100).toFixed(2),sidewaysWorldSlideSdCmPerS:+(sd(lv)*100).toFixed(1),sidewaysSlideReversals:revs(lv,0.05),headingWiggleRmsDeg:+(rms(hs)*180/Math.PI).toFixed(3),
    camDistSdCm:+(sd(r.map(x=>x[9]))*100).toFixed(2),screenJitterRmsPx:+rms(sj).toFixed(2),screenXRangePx:+((Math.max(...r.map(x=>x[10]))-Math.min(...r.map(x=>x[10])))*W/2).toFixed(1),
    perFrameMotionErrRmsPct:+(rms(scroll)*100).toFixed(1)};}
(async()=>{const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:900000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.setViewport({width:W,height:H,isMobile:true,hasTouch:true,deviceScaleFactor:1});
await p.goto('http://localhost:8090/?q=lite',{waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});
await p.tap('#begin').catch(()=>p.click('#begin'));await sleep(1500);
const cdp=await p.target().createCDPSession();await cdp.send('Emulation.setCPUThrottlingRate',{rate:5});
const go=()=>p.evaluate(()=>{const v=window.__vale;const q=v.quest();v.warp(q.wayfinder.x+14,q.wayfinder.z+6);});
const out={cpuThrottle:5};
for(const mode of ['before','after']){await p.evaluate(m=>window.__vale.setLegacyMotion(m==='before'),mode);out[mode]={};
  for(const kind of ['straight','curve']){seed=kind==='straight'?7:11;await go();await p.evaluate(f=>window.__vale.simFrames(f),phoneFrames(1.5,false));
    const R=await p.evaluate(f=>window.__vale.simFrames(f),phoneFrames(10,kind==='curve'));out[mode][kind]=metrics(R);}}
// B) real touch, throttled, noisy thumb (after path)
await p.evaluate(()=>window.__vale.setLegacyMotion(false));await go();await sleep(1500);
const jr=await p.$eval('#joy',e=>{const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,h:r.height};});
await p.touchscreen.touchStart(jr.x,jr.y);await p.touchscreen.touchMove(jr.x,jr.y-jr.h*0.6);await sleep(2000);await p.evaluate(()=>window.__vale.recStart());
const t0=Date.now();while(Date.now()-t0<10000){await p.touchscreen.touchMove(jr.x+gauss()*2.5,jr.y-jr.h*0.6+gauss()*2.5);await sleep(60);}
const RT=await p.evaluate(()=>window.__vale.recStop());await p.touchscreen.touchEnd();const d=[];for(let i=1;i<RT.length;i++)d.push(RT[i][0]-RT[i-1][0]);d.sort((a,b)=>a-b);
out.realTouchThrottled={...metrics(RT),frameMsP50:+d[Math.floor(d.length*.5)]?.toFixed(0),frameMsP95:+d[Math.floor(d.length*.95)]?.toFixed(0),note:'headless swiftshader: frame timing not phone-representative'};
out.errors=errs;console.log(JSON.stringify(out,null,1));await b.close();})();
