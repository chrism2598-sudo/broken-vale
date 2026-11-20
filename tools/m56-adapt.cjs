// M56 · Lite adaptive render resolution: headless proof.
//  A · deterministic: the REAL controller + renderer driven with synthetic presented-frame intervals (__vale.adapt.sim):
//      on-time holds 1.25 · sustained slow steps down to the 0.8 floor (rate-limited) and back up to 1.25 (rate-limited, one reversal)
//      · rare jitter causes no change · a GPU-limited model (slow above PR 1.0) settles without oscillating (backoff bounds probes)
//  B · real headless frames: ?adapt=1 (SwiftShader is slow) engages, resizes the canvas, no errors; default headless / Smooth / High
//      keep the fixed ratio; ?perf=1 overlay shows the ratio; diag adaptoff vs adaptive A/B reports it.
const PORT=process.env.PORT||'8095';const fs=require('fs');const pc=require(process.env.PUPPETEER_CORE);const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let bad=0;const ok=(c,m,x)=>{if(!c)bad++;console.log((c?'PASS ':'FAIL ')+m+(x!==undefined?' '+JSON.stringify(x).slice(0,700):''));};const OUT={};
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:900000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const page=async(dpr=2)=>{const p=await b.newPage();await p.setViewport({width:412,height:915,deviceScaleFactor:dpr,isMobile:true,hasTouch:true});p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));p.on('console',m=>{if(m.type()==='error')p.errs.push('console: '+m.text())});return p;};
 const open=async(p,q)=>{await p.goto(`http://localhost:${PORT}/${q}`,{waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:300000,polling:500});await p.evaluate(()=>{const t=document.getElementById('title');if(t&&!t.hidden)document.getElementById('tcont')?.click();});await sleep(1500);};
 // ---------- A · deterministic ----------
 let p=await page();await open(p,'?q=lite&qa=1&motion=fast');
 const A=await p.evaluate(()=>{const S=window.__vale.adapt.sim, rep=(v,s)=>Array(Math.round(s*1000/16.7)).fill(v);
  const slow=[];for(let i=0;i<Math.round(20000/25);i++)slow.push(i%2?16.7:33.3);
  let seed=7;const rnd=()=>((seed=(seed*1103515245+12345)>>>0)/4294967296);
  return {ontime:S(rep(16.7,20)),
   slowThenFast:S([...slow,...rep(16.7,60)]),
   jitter:S(Array.from({length:3600},()=>rnd()<0.02?33.3:16.7)),
   jitter3:S(Array.from({length:3600},()=>rnd()<0.03?33.3:16.7)),
   gpuModel:S((pr,i)=>pr>1.0+1e-6&&i%3===0?33.3:16.7,Math.round(180000/16.7)),
   fast120:S(rep(8.3,20))};});
 OUT.synthetic=A;
 const ch=t=>t.trace.slice(1);const gaps=t=>ch(t).map((x,i,a)=>i?x[0]-a[i-1][0]:x[0]);
 ok(ch(A.ontime).length===0&&A.ontime.stats.current===1.25,'on-time 60 Hz frames: holds PR 1.25, no changes',A.ontime.stats);
 ok(ch(A.fast120).length===0,'on-time 120 Hz frames: no changes',A.fast120.stats);
 ok(ch(A.jitter).length===0,'2% random missed frames for 60 s (p95 on time): no changes',A.jitter.stats);
 ok(ch(A.jitter3).length<=3&&ch(A.jitter3).every((x,i,c)=>i===0||x[1]<c[i-1][1]),'3% random missed frames for 60 s, ratio-independent (at the p95 boundary): slow drift down only, no up/down pumping',{changes:ch(A.jitter3).map(x=>[Math.round(x[0]/100)/10,x[1]])});
 {const c=ch(A.slowThenFast),pr=c.map(x=>x[1]),dn=pr.slice(0,5),upp=pr.slice(5);const g=gaps(A.slowThenFast);
  ok(JSON.stringify(dn)===JSON.stringify([1.15,1.05,0.95,0.85,0.8]),'sustained slow frames: steps down 1.25→0.8 one 0.1 step at a time to the floor',c);
  ok(JSON.stringify(upp)===JSON.stringify([0.85,0.95,1.05,1.15,1.25]),'sustained headroom: steps back up to 1.25 one step at a time',upp);
  ok(g.slice(1,5).every(x=>x>=1500)&&g.slice(5).every(x=>x>=3000),'rate-limited: down steps ≥1.5 s apart, up steps ≥3 s apart',g.map(x=>Math.round(x)));
  let rev=0;for(let i=2;i<pr.length;i++)if(Math.sign(pr[i]-pr[i-1])!==Math.sign(pr[i-1]-pr[i-2]))rev++;ok(rev===1,'no oscillation: exactly one direction change',{rev});
  ok(c.every((x,i)=>i===0||x[2]!==c[i-1][2]),'each step resizes the real drawing buffer once',c.map(x=>x[2]));
  const rz=c.map(x=>x[3]);ok(rz.slice(1).every(x=>x<20),'resize cost per step after the first (CPU ms, SwiftShader; the first step waits for queued headless frames)',rz);
  ok(A.slowThenFast.stats.steps===10&&A.slowThenFast.stats.min===0.8&&A.slowThenFast.stats.max===1.25,'stats: 10 steps, min 0.8, max 1.25, time at each level',A.slowThenFast.stats);}
 {const c=ch(A.gpuModel),pr=c.map(x=>x[1]),ups=c.filter((x,i)=>i>0&&x[1]>c[i-1][1]).map(x=>x[0]);const ug=ups.map((x,i)=>i?x-ups[i-1]:0).slice(1);
  ok(Math.min(...pr)>=0.95&&c.length<=14,'GPU-limited model (slow above PR 1.0), 180 s: settles at 0.95, never overshoots to the floor, bounded changes',{changes:c.length,trace:c.map(x=>[Math.round(x[0]/100)/10,x[1]])});
  ok(ug.every((x,i)=>i===0||x>=ug[i-1]-1),'probe-up intervals back off (non-decreasing)',ug.map(x=>Math.round(x/1000)));}
 const st0=await p.evaluate(()=>({pr:window.__vale.adapt.stats(),dpr:devicePixelRatio}));await sleep(500);
 const st1=await p.evaluate(()=>({stats:window.__vale.adapt.stats(),w:document.querySelector('canvas').width}));
 ok(st1.stats.current===1.25&&st1.stats.enabled===false&&st1.w===Math.floor(412*1.25),'default headless (no &adapt=1): adaptive inactive, sits at base 1.25 (DPR 2)',st1);
 ok(p.errs.length===0,'A: no page errors',p.errs.slice(0,3));await p.close();
 // ---------- B · real frames ----------
 p=await page();await open(p,'?q=lite&qa=1&motion=fast&adapt=1');await p.evaluate(()=>window.__vale.warp(0,6));
 const tr=[];for(let i=0;i<30;i++){await sleep(1000);tr.push(await p.evaluate(()=>{const s=window.__vale.adapt.stats();return [s.current,document.querySelector('canvas').width,s.steps,s.resizeMsMax];}));}
 const sR=await p.evaluate(()=>window.__vale.adapt.stats());OUT.real=sR;OUT.realTrace=tr;
 ok(sR.enabled&&sR.steps===0&&sR.current===1.25,'real headless frames (&adapt=1, SwiftShader frames >250 ms = gaps, like loading hitches): adaptive on but never steps on gaps',{stats:sR,trace:tr.map(x=>x[0]).join(' ')});
 ok(tr.every(x=>x[1]===Math.floor(412*x[0])),'canvas back buffer always matches the current ratio',tr.slice(-3));
 
 ok(p.errs.length===0,'B real: no page errors',p.errs.slice(0,3));await p.close();
 p=await page();await open(p,'?q=lite&qa=1&motion=smooth&adapt=1');await sleep(12000);const sS=await p.evaluate(()=>window.__vale.adapt.stats());
 ok(!sS.enabled&&sS.steps===0&&sS.current===1.25,'Smooth (30 fps): unchanged, fixed 1.25 even with &adapt=1',sS);await p.close();
 p=await page();await open(p,'?q=high&qa=1&motion=fast&adapt=1');await sleep(3000);const sH=await p.evaluate(()=>({s:window.__vale.adapt.stats()}));
 ok(sH.s===null,'High: no adaptive controller (unchanged)',sH);await p.close();
 p=await page();await open(p,'?q=lite&qa=1&motion=fast&adapt=1&perf=1');await sleep(4000);const hud=await p.evaluate(()=>[...document.querySelectorAll('div')].map(d=>d.textContent).find(t=>/^FPS/.test(t||''))||'');
 ok(/res: PR [\d.]+ adaptive \(min [\d.]+ max [\d.]+, \d+ steps\)/.test(hud),'?perf=1 overlay shows the adaptive ratio',hud.split('\n').pop());await p.close();
 // diag A/B (adaptoff vs adaptive) with &adapt=1
 p=await page();await p.goto(`http://localhost:${PORT}/diag/?q=lite&tod=0.42&motion=fast&diag=meadow&seq=adaptoff,base&secs=15&warm=2&cool=1&adapt=1`,{waitUntil:'load'});
 let r=null;for(let i=0;i<400&&!r;i++){await sleep(2000);r=await p.evaluate(()=>window.__diag&&window.__diag.result);}
 OUT.diag=r&&r.runs.map(x=>({cfg:x.cfg,pr:x.pixelRatio,fps:x.fpsAvg,p95:x.frameMs.p95,adapt:x.adapt,notes:x.notes}));
 ok(r&&r.runs[0].adapt.enabled===false&&r.runs[0].adapt.steps===0&&r.runs[0].pixelRatio===1.25,'diag adaptoff: fixed 1.25, 0 steps',OUT.diag&&OUT.diag[0]);
 ok(r&&r.runs[1].adapt.enabled===true&&typeof r.runs[1].adapt.timeAtS==='object','diag base: adaptive on, JSON has current/min/max/steps/time at each level',OUT.diag&&OUT.diag[1]);
 const card=await p.evaluate(()=>document.getElementById('diagcard')?.textContent||'');ok(/adaptive res ON/.test(card)&&/adaptive res off/.test(card),'diag card shows adaptive on/off per run');
 ok(p.errs.length===0,'diag: no page errors',p.errs.slice(0,3));await p.close();
 fs.writeFileSync(process.env.OUT||'/tmp/m56-adapt.json',JSON.stringify(OUT,null,1));
 console.log(bad?`M56-ADAPT FAIL ${bad}`:'M56-ADAPT PASS');await b.close();process.exit(bad?1:0);})().catch(e=>{console.log('ERR',e.message);process.exit(2)});
