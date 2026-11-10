// Running-jitter probe: phone portrait, Lite, real touch joystick at full deflection + deterministic dt-jitter simulation.
// Records per-frame player root, hips (mesh) world pos, camera pos, camera distance and the player's screen position,
// then reports oscillation/reversal metrics and frame-time p50/p95 (idle vs run). Usage: node tools/motion-probe.cjs [label]
const puppeteer=require(process.env.PUPPETEER_CORE||'puppeteer-core');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const W=390,H=844,label=process.argv[2]||'run';
const pct=(a,q)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.min(s.length-1,Math.floor(q*s.length))]:NaN;};
function metrics(R){ // R rows: [t,dt,px,pz,hx,hz,cx,cy,cz,dist,sx,sy,speed,facing,yaw]
  const rows=R.filter(r=>r[12]>4);if(rows.length<10)return {n:rows.length};
  const fx=Math.sin(rows[0][13]),fz=Math.cos(rows[0][13]);
  let camBack=0,meshBack=0,rootBack=0,sxs=[],sys=[],dd=[],revDist=0,revSy=0,lastDd=0,lastDsy=0,meshOff=[];
  for(let i=1;i<rows.length;i++){const a=rows[i-1],b=rows[i];
    const cAl=(b[6]-a[6])*fx+(b[8]-a[8])*fz, mAl=(b[4]-a[4])*fx+(b[5]-a[5])*fz, rAl=(b[2]-a[2])*fx+(b[3]-a[3])*fz;
    if(cAl<-0.002)camBack++; if(mAl<-0.002)meshBack++; if(rAl<-0.002)rootBack++;
    const dsx=(b[10]-a[10])*W/2,dsy=(b[11]-a[11])*H/2;sxs.push(dsx);sys.push(dsy);
    const d=b[9]-a[9];dd.push(d);if(Math.abs(d)>0.004&&Math.abs(lastDd)>0.004&&Math.sign(d)!==Math.sign(lastDd))revDist++;if(Math.abs(d)>0.004)lastDd=d;
    if(Math.abs(dsy)>0.4&&Math.abs(lastDsy)>0.4&&Math.sign(dsy)!==Math.sign(lastDsy))revSy++;if(Math.abs(dsy)>0.4)lastDsy=dsy;
    meshOff.push((b[4]-b[2])*fx+(b[5]-b[3])*fz);}
  const rms=a=>Math.sqrt(a.reduce((s,x)=>s+x*x,0)/a.length);const dists=rows.map(r=>r[9]),sy=rows.map(r=>r[11]*H/2),sx=rows.map(r=>r[10]*W/2);
  return {n:rows.length,camBackFrames:camBack,meshBackFrames:meshBack,rootBackFrames:rootBack,
    camDist:{min:+Math.min(...dists).toFixed(3),max:+Math.max(...dists).toFixed(3),reversals:revDist,stepRmsCm:+(rms(dd)*100).toFixed(2)},
    screenPx:{xRange:+(Math.max(...sx)-Math.min(...sx)).toFixed(1),yRange:+(Math.max(...sy)-Math.min(...sy)).toFixed(1),frameJitterRms:+rms(sys.map((y,i)=>Math.hypot(y,sxs[i]))).toFixed(2),yReversals:revSy},
    meshAlongTrackOffset:{min:+Math.min(...meshOff).toFixed(3),max:+Math.max(...meshOff).toFixed(3)}};}
const ft=R=>{const d=[];for(let i=1;i<R.length;i++)d.push(R[i][0]-R[i-1][0]);return {frames:R.length,p50:+pct(d,.5).toFixed(1),p95:+pct(d,.95).toFixed(1),max:+Math.max(...d).toFixed(1)};};
(async()=>{const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:600000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.setViewport({width:W,height:H,isMobile:true,hasTouch:true,deviceScaleFactor:1});
await p.goto('http://localhost:8090/?q=lite',{waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});
await p.tap('#begin').catch(()=>p.click('#begin'));await sleep(1500);
const go=async()=>{await p.evaluate(()=>{const v=window.__vale;const q=v.quest();v.warp(q.wayfinder.x+14,q.wayfinder.z+6);});await sleep(1500);};
await go();
const out={label};
await p.evaluate(()=>window.__vale.recStart());await sleep(5000);const idle=await p.evaluate(()=>window.__vale.recStop());out.idleFrameMs=ft(idle);
const jr=await p.$eval('#joy',e=>{const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,h:r.height};});
await p.touchscreen.touchStart(jr.x,jr.y);for(let k=1;k<=6;k++){await p.touchscreen.touchMove(jr.x,jr.y-jr.h*0.6*k/6);await sleep(30);}
await sleep(2500);await p.evaluate(()=>window.__vale.recStart());await sleep(9000);const run=await p.evaluate(()=>window.__vale.recStop());await p.touchscreen.touchEnd();
out.runFrameMs=ft(run);out.touchRun=metrics(run);await sleep(1500);
// Deterministic: same input through update() with a phone-like dt pattern (60 Hz with 30 Hz drops, jitter and two 100 ms spikes).
await go();const dts=[];for(let i=0;i<420;i++){let d=1/60;if(i%3===1)d=1/30;if(i%7===0)d=1/45;if(i===150||i===300)d=0.1;dts.push(d);}
const warm=await p.evaluate(d=>window.__vale.sim(d,0,-1),dts.slice(0,120));void warm;
out.simVariableDt=metrics(await p.evaluate(d=>window.__vale.sim(d,0,-1),dts));
out.simSteady60=metrics(await p.evaluate(d=>window.__vale.sim(d,0,-1),new Array(300).fill(1/60)));
const um=R=>{const d=R.map(r=>r[15]);return {p50:+pct(d,.5).toFixed(3),p95:+pct(d,.95).toFixed(3)};};
await go();await p.evaluate(()=>window.__vale.sim(new Array(60).fill(1/60),0,0));const sIdle=await p.evaluate(()=>window.__vale.sim(new Array(300).fill(1/60),0,0));
const sRun=await p.evaluate(()=>window.__vale.sim(new Array(300).fill(1/60),0,-1));out.updateCpuMs={idle:um(sIdle),run:um(sRun)};
out.errors=errs;console.log(JSON.stringify(out,null,1));await b.close();})();
