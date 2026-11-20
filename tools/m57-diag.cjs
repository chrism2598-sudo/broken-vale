// M57 · diag-only tooling test. Serves expected: dist/ at http://localhost:$PORT/ with dist/diag at /diag/.
//  1 production bundle carries none of the M57 diag code · 2 diag copy of the adaptive controller == production controller
//  (identical traces) · 3 adaptfast reacts to severe stutter faster than production · adaptfloorX reaches X · 4 a real diag run
//  with &draws=1 + adaptfast/adaptfloor tokens: draws breakdown (tallied == renderer.info calls), stalls, world snapshot in the JSON
//  · 5 stall instrumentation logs blur/visibility/pixel-ratio events next to a gap.
const PORT=process.env.PORT||'8095';const fs=require('fs'),path=require('path');const pc=require(process.env.PUPPETEER_CORE);const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let bad=0;const ok=(c,m,x)=>{if(!c)bad++;console.log((c?'PASS ':'FAIL ')+m+(x!==undefined?' '+JSON.stringify(x).slice(0,700):''));};const OUT={};
const MARK=['talliedPerFrame','stallLog','adaptfast','createDiagAdapt','charactersInFrustum'];
const js=d=>fs.readdirSync(d).filter(f=>f.endsWith('.js')).map(f=>path.join(d,f));
const hits=js('dist/assets').flatMap(f=>{const s=fs.readFileSync(f,'utf8');return MARK.filter(m=>s.includes(m)).map(m=>path.basename(f)+':'+m);});ok(hits.length===0,'production bundle has no M57 diag markers',hits);
const dS=js('dist/diag/assets').map(f=>fs.readFileSync(f,'utf8')).join('\n');ok(['talliedPerFrame','stallLog','adaptfast'].every(m=>dS.includes(m)),'diag build carries the M57 code');
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:900000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 let p=await b.newPage();await p.setViewport({width:412,height:915,deviceScaleFactor:2,isMobile:true,hasTouch:true});p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));
 await p.goto(`http://localhost:${PORT}/diag/?q=lite&qa=1&motion=fast`,{waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready&&window.__diag',{timeout:300000,polling:500});
 const S=await p.evaluate(()=>{const rep=(v,s)=>Array(Math.round(s*1000/v)).fill(v);const slow=[];for(let i=0;i<800;i++)slow.push(i%2?16.7:33.3);
  const prof={slowThenFast:[...slow,...rep(16.7,60)],gpu:(()=>{const a=[];for(let i=0;i<6000;i++)a.push(i%3===0?33.3:16.7);return a;})()};
  const r={};for(const k in prof){const P=window.__vale.adapt.sim(prof[k]);const C=window.__diag.adaptSim(prof[k],{});r[k]={prod:P.trace.slice(1).map(x=>[Math.round(x[0]),x[1]]),copy:C.trace.slice(1).map(x=>[Math.round(x[0]),x[1]])};}
  // severe stutter: 4 s on time, then bursts of 60-80 ms frames (3+ per second) for 10 s, then on time
  const sev=[...rep(16.7,4)];for(let s=0;s<10;s++){for(let i=0;i<50;i++)sev.push(i%12===0?70:16.7);}sev.push(...rep(16.7,20));
  const P=window.__vale.adapt.sim(sev),C=window.__diag.adaptSim(sev,{fast:true}),F7=window.__diag.adaptSim(slow.concat(slow,slow),{floor:0.6});
  r.severe={prod:P.trace.slice(1).map(x=>[Math.round(x[0]),x[1]]),fast:C.trace.slice(1).map(x=>[Math.round(x[0]),x[1]]),emergencies:C.emergencies};r.floor06=F7.trace.slice(1).map(x=>x[1]);window.__vale.adapt.reset();return r;});
 OUT.sim=S;
 ok(JSON.stringify(S.slowThenFast.prod)===JSON.stringify(S.slowThenFast.copy)&&JSON.stringify(S.gpu.prod)===JSON.stringify(S.gpu.copy)&&S.slowThenFast.prod.length===10,'diag copy (adaptcopy) == production controller on identical inputs',{prod:S.slowThenFast.prod.length,gpu:S.gpu.prod.length});
 const first=(t,v)=>{const e=t.find(x=>x[1]<=v);return e?e[0]:null;};
 ok(S.severe.emergencies>=1&&first(S.severe.fast,0.95)!==null&&(first(S.severe.prod,0.95)===null||first(S.severe.fast,0.95)<first(S.severe.prod,0.95)),'adaptfast: severe stutter reaches 0.95 sooner than production',{fast:S.severe.fast,prod:S.severe.prod,emergencies:S.severe.emergencies});
 ok(S.floor06[S.floor06.length-1]===0.6,'adaptfloor0.6 (measurement only) steps to 0.6',S.floor06);
 // stall events
 const st=await p.evaluate(async()=>{window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'));window.__diag.setPR(1.0);await new Promise(r=>setTimeout(r,1500));window.__diag.setPR(1.25);await new Promise(r=>setTimeout(r,1500));return window.__diag.stallLog();});
 ok(st.events.some(e=>e.e==='blur')&&st.events.filter(e=>e.e==='pixelRatio').length>=2&&st.gaps.some(g=>g.near.some(n=>/pixelRatio/.test(n))),'stall log: blur/focus + pixel-ratio events, and gaps list nearby events',{ev:st.events.slice(-4),gap:st.gaps.slice(-1)});
 ok(p.errs.length===0,'sim page: no page errors',p.errs);await p.close();
 // real diag run
 p=await b.newPage();await p.setViewport({width:412,height:915,deviceScaleFactor:2,isMobile:true,hasTouch:true});p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));
 await p.goto(`http://localhost:${PORT}/diag/?q=lite&tod=0.42&motion=fast&diag=underbridge&seq=base,adaptfast,adaptfloor0.7&secs=8&warm=2&cool=1&draws=1`,{waitUntil:'load'});
 await p.waitForFunction('window.__diag&&window.__diag.status&&/recording/.test(window.__diag.status)',{timeout:600000,polling:500});
 await p.evaluate(()=>{window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'));});
 let r=null;for(let i=0;i<400&&!r;i++){await sleep(2000);r=await p.evaluate(()=>window.__diag.result);}
 OUT.run=r&&r.runs.map(x=>({cfg:x.cfg,calls:x.drawCalls,draws:x.draws&&{tallied:x.draws.talliedPerFrame,info:x.draws.infoCallsPerFrame,cat:x.draws.byCategory},adapt:x.adapt,notes:x.notes,gameSecs:x.gameSecs,stalls:x.stalls.length,camStart:x.camStart,callsPer10s:x.callsPer10s}));
 ok(!!r&&r.runs.length===3,'diag run with draws + adaptfast + adaptfloor0.7 completed');
 if(r){const x=r.runs[0];ok(x.draws&&Math.abs(x.draws.talliedPerFrame-x.draws.infoCallsPerFrame)<=Math.max(3,0.03*x.draws.infoCallsPerFrame),'draw tally matches renderer.info calls',{t:x.draws&&x.draws.talliedPerFrame,i:x.draws&&x.draws.infoCallsPerFrame});
  ok(x.draws&&Object.keys(x.draws.byCategory).length>=6&&x.draws.topObjects.length>0&&x.draws.visibility.meshes>0,'breakdown has categories, top objects, visibility',x.draws&&Object.keys(x.draws.byCategory));
  ok(r.runs[1].adapt.controller==='diag copy'&&r.runs[1].adapt.opts.fast===true&&r.runs[2].adapt.opts.floor===0.7&&r.runs[2].adapt.floor===0.7,'adaptfast / adaptfloor0.7 use the diag copy with their options',[r.runs[1].adapt.opts,r.runs[2].adapt.floor]);
  ok(r.world&&typeof r.world.xp!=='undefined'&&Array.isArray(r.stallLog.events)&&r.stallLog.events.some(e=>e.e==='blur'),'JSON has world snapshot and the stall event log (blur)',{world:r.world,ev:r.stallLog.events.slice(-6)});
  ok(x.stalls.length>0&&x.stalls[0].near!==undefined&&typeof x.stalls[0].gapMs==='number','long rAF gaps are recorded with nearby events (headless frames are all >100 ms)',x.stalls.slice(0,2));
  ok(typeof x.gameSecs==='number'&&x.camStart.length===3&&x.callsPer10s.length>=1,'gameSecs, camStart, callsPer10s present',{g:x.gameSecs,c:x.camStart});
  const card=await p.evaluate(()=>document.getElementById('diagcard')?.textContent||'');ok(/draws\/frame/.test(card)&&/gaps>100ms/.test(card),'card shows the breakdown and gaps');}
 ok(p.errs.length===0,'diag run: no page errors',p.errs.slice(0,3));await p.close();
 fs.writeFileSync(process.env.OUT||'/tmp/m57-diag.json',JSON.stringify(OUT,null,1));console.log(bad?`M57-DIAG FAIL ${bad}`:'M57-DIAG PASS');await b.close();process.exit(bad?1:0);})().catch(e=>{console.log('ERR',e.message);process.exit(2)});
