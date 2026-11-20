// M55 · diag build smoke test. Serves expected: dist/ at http://localhost:$PORT/ (production) with the diag build at /diag/.
//  1. production bundle carries no diag code (marker grep) and the production page exposes no diag hooks;
//  2. every diag switch runs headless (short secs) on meadow, plus castle + underbridge, with no page errors and real frames;
//  3. the diag build cannot write the player's save: same-origin localStorage is byte-identical after runs, explicit writes,
//     saveNow(), and the title "New game → yes" path (clearSave + reload).
const PORT=process.env.PORT||'8095';const fs=require('fs'),path=require('path');
const pc=require(process.env.PUPPETEER_CORE);const sleep=ms=>new Promise(r=>setTimeout(r,ms));const DIR=process.env.SHOTDIR||'shots';
let bad=0;const ok=(c,m,x)=>{if(!c)bad++;console.log((c?'PASS ':'FAIL ')+m+(x!==undefined?' '+JSON.stringify(x).slice(0,600):''));};
const MARK=['__diagBlocked','EXT_disjoint_timer_query_webgl2','DIAG BUILD','diagbadge','lodspread','M55 diag'];
const m0=(r,c)=>r.runs.find(x=>x.cfg===c).drawCalls.avg;
const js=d=>fs.readdirSync(d).filter(f=>f.endsWith('.js')).map(f=>path.join(d,f));
const prodHits=js('dist/assets').flatMap(f=>{const s=fs.readFileSync(f,'utf8');return MARK.filter(m=>s.includes(m)).map(m=>path.basename(f)+':'+m);});
ok(prodHits.length===0,'production bundle has no diag markers',prodHits);
const diagS=js('dist/diag/assets').map(f=>fs.readFileSync(f,'utf8')).join('\n');ok(MARK.every(m=>diagS.includes(m)),'diag build carries the diag code',MARK.filter(m=>!diagS.includes(m)));
ok(!fs.readdirSync('dist/assets').some(f=>/^diag-/.test(f)),'no diag chunk in production assets');
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:900000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const SAVE=JSON.stringify({v:1,started:true,done:false,xp:321,seals:{dawn:true},runes:[0,0,0],wind:false,warden:false,mirrors:[0,0,0,0],beacon:false,echo:false,charted:[true,false,false,false,false,false,false],cave:0,coast:0,sea:0,lamp:0,weapons:['rusty'],weapon:'rusty'});
 const snap=p=>p.evaluate(()=>JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])));
 const page=async()=>{const p=await b.newPage();await p.setViewport({width:412,height:915,deviceScaleFactor:1,isMobile:true,hasTouch:true});p.errs=[];p.on('pageerror',e=>{p.errs.push(e.message);console.log('  pageerror',e.message.slice(0,200));});p.on('response',r=>{if(r.status()>=400)console.log('  http',r.status(),r.url());});p.on('console',m=>{if(m.type()==='error')console.log('  console.error',m.text().slice(0,200));});return p;};
 // seed the player's save on the production page (same origin as /diag/)
 let p=await page();await p.goto(`http://localhost:${PORT}/?q=lite&qa=1`,{waitUntil:'load'});
 await p.evaluate(s=>{localStorage.clear();localStorage.setItem('vale3d-hero',JSON.stringify({name:'Ilka',sex:'female'}));localStorage.setItem('vale3d-save',s);localStorage.setItem('vale3d-save-ext',JSON.stringify({schema:2,unknown:{futureField:7}}));localStorage.setItem('vale3d-motion','smooth');},SAVE);
 await p.goto(`http://localhost:${PORT}/?q=lite&qa=1`,{waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:300000,polling:500});
 const prodHooks=await p.evaluate(()=>({diag:'__diag' in window,blocked:'__diagBlocked' in window,badge:!!document.getElementById('diagbadge'),native:/\[native code\]/.test(String(Storage.prototype.setItem))}));
 ok(!prodHooks.diag&&!prodHooks.blocked&&!prodHooks.badge&&prodHooks.native,'production page exposes no diag hooks (native Storage)',prodHooks);
 const before=await snap(p);await p.close();
const QUICK=!!process.env.QUICK;
 const runs=QUICK?[['meadow','base']]:[['meadow','base,pr1.25,pr1,pr0.75,shoff,shhalf,shfreeze,grassoff,foloff,folopaque,vegoff,ovl,lodspread,simcap2,pr0.75~shoff'],['castle','base,shoff'],['underbridge','base,vegoff']];
 const out=[];
 for(const [sc,seq] of runs){p=await page();
  try{await p.goto(`http://localhost:${PORT}/diag/?q=lite&tod=0.42&motion=fast&diag=${sc}&seq=${seq}&secs=${process.env.SECS||6}&warm=2&cool=1`,{waitUntil:'load'});
   {let last='',t0=Date.now();for(;;){const st=await p.evaluate(()=>window.__diag?(window.__diag.result?'DONE':window.__diag.status):'loading ready='+!!(window.__vale&&window.__vale.ready)+' title='+document.getElementById('title').hidden+' '+(document.querySelector('.toast,#toast')||{}).textContent);if(st!==last){console.log(`  … ${sc} +${((Date.now()-t0)/1000).toFixed(0)}s ${st}`);last=st;}if(st==='DONE')break;if(Date.now()-t0>800000)throw new Error('timeout at '+st);await sleep(2000);}}
   const r=await p.evaluate(()=>window.__diag.result);await sleep(300);await p.screenshot({path:`${DIR}/m55-diag-${sc}.png`});out.push(r);
   ok(r.label==='HEADLESS ESTIMATE'&&r.motion==='fast'&&r.runs.length===seq.split(',').length,`${sc}: diag sequence completed, labelled HEADLESS ESTIMATE, motion fast`,{gpuTimer:r.gpuTimer,build:r.build});
   for(const x of r.runs){const unk=x.notes.filter(n=>n.startsWith('unknown'));if(x.cfg.includes('~'))ok(x.pixelRatio===0.75&&x.drawCalls.avg<m0(r,'base'),'combined token applied',[x.pixelRatio,x.drawCalls.avg]);ok(x.frames>0&&x.drawCalls.avg>0&&unk.length===0,`${sc} [${x.cfg}] ran`,{frames:x.frames,fps:x.fpsAvg,p95:x.frameMs.p95,calls:x.drawCalls.avg,tris:x.triangles.avg,pr:x.pixelRatio,buf:x.drawingBuffer,gpu:x.gpu,cpu:x.cpuMs.frame,steps:x.counts.stepsHist,swaps:x.counts.grassSwaps,lod:x.counts.liteLodTicks,notes:x.notes});}
   ok(p.errs.length===0,`${sc}: no page errors`,p.errs.slice(0,3));
   ok(await snap(p)===before,`${sc}: localStorage unchanged after the diag run`);
  }catch(e){bad++;console.log('FAIL',sc,'CRASH',e.message.slice(0,200));}
  await p.close();}
 // switch effects actually applied (meadow): pixel ratio, shadows, grass/foliage
 const m=!QUICK&&out[0]&&out[0].runs;if(m){const g=c=>m.find(x=>x.cfg===c);
  ok(g('pr0.75').pixelRatio===0.75&&g('pr1').pixelRatio===1&&g('base').pixelRatio===1,'pixel-ratio switch applied (headless DPR 1 → base 1)',m.map(x=>[x.cfg,x.pixelRatio]));
  ok(g('shoff').drawCalls.avg<g('base').drawCalls.avg,'shoff removes the shadow pass draws',[g('base').drawCalls.avg,g('shoff').drawCalls.avg]);
  ok(g('grassoff').triangles.avg<g('base').triangles.avg,'grassoff removes grass triangles',[g('base').triangles.avg,g('grassoff').triangles.avg]);
  ok(g('foloff').drawCalls.avg<g('base').drawCalls.avg&&/alpha-tested meshes/.test(g('foloff').notes.join()),'foloff hides alpha-tested foliage',[g('foloff').drawCalls.avg,g('foloff').notes]);
  ok(g('vegoff').triangles.avg<g('grassoff').triangles.avg,'vegoff removes grass and foliage',[g('vegoff').triangles.avg]);
  ok(g('simcap2').counts.simCap===2,'simcap A/B applied in diag only',g('simcap2').counts);}
 // explicit write attempts from the diag build
 p=await page();await p.goto(`http://localhost:${PORT}/diag/?q=lite&qa=1`,{waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:300000,polling:500});
 const w=await p.evaluate(()=>{const s=window.__vale.saveNow();localStorage.setItem('vale3d-save','{"v":1,"xp":0}');localStorage.removeItem('vale3d-save');localStorage.removeItem('vale3d-save-ext');localStorage.clear();return {saveNow:s,status:window.__vale.saveStatus(),blocked:window.__diagBlocked.slice(-6),badge:document.getElementById('diagbadge')?.textContent};});
 ok(w.saveNow===false&&w.status.readOnly==='perf'&&w.blocked.length>=4,'diag build: saveNow refused, explicit set/remove/clear blocked',w);
 ok(await snap(p)===before,'diag build: localStorage unchanged after explicit write attempts');
 await p.evaluate(()=>{const t=document.getElementById('tyes');t&&t.click();});await sleep(1500);
 try{await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:300000,polling:500});}catch{}
 ok(await snap(p)===before,'diag build: "New game → yes" (clearSave + reload) erased nothing');ok(p.errs.length===0,'diag write-attempt page: no page errors',p.errs.slice(0,3));
 await p.close();
 fs.writeFileSync(process.env.OUT||'/tmp/m55-diag-smoke.json',JSON.stringify(out,null,1));
 console.log(bad?`M55-DIAG-SMOKE FAIL ${bad}`:'M55-DIAG-SMOKE PASS');await b.close();process.exit(bad?1:0);})().catch(e=>{console.log('ERR',e.message);process.exit(2)});
