const PORT=process.env.PORT||'8090';
// M53 · headless frame-time sampler (software rendering via SwiftShader: NOT phone numbers). Per scene × quality:
//  (a) wall-clock rAF frame deltas over SECS seconds while the camera orbits a fixed path (same logic as src/perfhud.ts:
//      avg / p95 / p99 / long >33 ms / >50 ms), (b) the game's synchronous bench(60) render cost, (c) load timings
//      (navigation start → first rAF with the canvas, → __vale.ready), (d) per-frame draw calls / triangles.
const pc=require(process.env.PUPPETEER_CORE);const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const SECS=+(process.env.SECS||8);
const S={hub:['shot=spawn&tod=0.4','__vale.warp(0,6)'],'night-hub':['shot=spawn&tod=0.98','__vale.warp(0,6)'],track:['shot=spawn&tod=0.4','__vale.warp(-12,24)'],castle:['shot=m20-hall','']};
const QS=(process.env.QS||'lite,high').split(',');
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:600000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const out=[];
 for(const q of QS)for(const [n,[qs,js]] of Object.entries(S)){const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message.slice(0,200)));
  await p.setViewport({width:412,height:915,deviceScaleFactor:1,isMobile:true,hasTouch:true});
  await p.evaluateOnNewDocument(()=>{localStorage.setItem('vale3d-hero',JSON.stringify({name:'Ilka',sex:'female'}));
    window.__ft={first:null,ready:null};const f=t=>{if(window.__ft.first===null&&document.querySelector('canvas'))window.__ft.first=t;if(window.__ft.ready===null&&window.__vale&&window.__vale.ready)window.__ft.ready=performance.now();if(window.__ft.ready===null)requestAnimationFrame(f);};requestAnimationFrame(f);});
  try{await p.goto(`http://localhost:${PORT}/?q=${q}&${qs}`,{waitUntil:'load',timeout:120000});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(3000);
   if(js)await p.evaluate(js);await p.evaluate(()=>window.__vale.sim(Array(30).fill(1/30),0,0));await sleep(1000);
   const load=await p.evaluate(()=>window.__ft);
   const rafs=await p.evaluate(secs=>new Promise(res=>{const d=[];let last=-1,t0=-1;const inCastle=window.__vale.castle&&window.__vale.castle().inCastle;
     const f=t=>{if(t0<0)t0=t;if(last>=0)d.push(t-last);last=t;const k=(t-t0)/(secs*1000);const yaw=Math.PI+k*Math.PI*2;if(!inCastle)window.__vale.view(yaw,yaw-Math.PI,0.1,7);if(t-t0<secs*1000)requestAnimationFrame(f);else res(d);};requestAnimationFrame(f);}),SECS);
   const a=[...rafs].sort((x,y)=>x-y),pct=q=>a[Math.min(a.length-1,Math.floor(q*a.length))],avg=a.reduce((s,v)=>s+v,0)/a.length;
   const bn=await p.evaluate(()=>{const V=window.__vale;const x=V.bench(5),y=V.bench(10);return {avg:y.avg,p95:y.p95,calls:Math.round((y.calls-x.calls)/10),tris:Math.round((y.tris-x.tris)/10),rawCalls:y.calls,rawTris:y.tris};});
   const row={q,scene:n,frames:a.length,fps:+(1000/avg).toFixed(1),avg:+avg.toFixed(1),p95:+pct(.95).toFixed(1),p99:+pct(.99).toFixed(1),long33:a.filter(v=>v>33).length,long50:a.filter(v=>v>50).length,
     benchAvg:+bn.avg.toFixed(1),benchP95:+bn.p95.toFixed(1),firstFrameMs:load.first&&+load.first.toFixed(0),readyMs:load.ready&&+load.ready.toFixed(0),benchRaw:{calls:bn.rawCalls,tris:bn.rawTris},errors:errs.length};
   out.push(row);console.log(JSON.stringify(row));}catch(e){console.log(n,q,'CRASH',e.message.slice(0,200));out.push({q,scene:n,crash:e.message.slice(0,200)});}
  await p.close();}
 require('fs').writeFileSync(process.env.OUT||'/tmp/m53-frametimes.json',JSON.stringify(out,null,1));await b.close();})().catch(e=>{console.log('ERR',e.message);process.exit(2)});
