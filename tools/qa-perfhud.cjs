const PORT=process.env.PORT||'8090';
// M53 · ?perf=1 overlay: present + sane stats with the flag; absent (chunk never requested, no window.__perf, no overlay) without it.
const pc=require(process.env.PUPPETEER_CORE);const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:600000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let fails=0;const ok=(n,c,v)=>{if(!c)fails++;console.log((c?'PASS ':'FAIL ')+n,JSON.stringify(v));};
for(const flag of [true,false]){const p=await b.newPage();await p.setViewport({width:412,height:915,isMobile:true,hasTouch:true});const errs=[],reqs=[];
 p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('request',r=>reqs.push(r.url()));
 await p.evaluateOnNewDocument(()=>{localStorage.setItem('vale3d-hero',JSON.stringify({name:'Ilka',sex:'female'}));});
 await p.goto(`http://localhost:${PORT}/?q=lite&shot=spawn${flag?'&perf=1':''}`,{waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(6000);
 const r=await p.evaluate(()=>({perf:!!window.__perf,stats:window.__perf?window.__perf.stats():null,text:[...document.querySelectorAll('div')].map(d=>d.textContent).find(t=>/^FPS /.test(t||''))||null}));
 const chunk=reqs.some(u=>/perfhud/.test(u));
 if(flag){const s=r.stats;ok('overlay present with ?perf=1',r.perf&&!!r.text,{text:r.text});
  ok('stats sane (frames>0, avg>0, p95>=avg-ish, p99>=p95)',s&&s.frames>0&&s.avg>0&&s.p99>=s.p95&&s.p95>0,s);
  ok('load times recorded (first frame, ready)',s&&s.firstFrameMs!==null&&s.readyMs!==null&&s.readyMs>=s.firstFrameMs,{first:s&&s.firstFrameMs,ready:s&&s.readyMs});
  ok('memory shown honestly (value only if performance.memory exists)',(s.memMB===null)===(!/JS heap/.test(r.text))&&(s.memMB!==null||/memory: unavailable/.test(r.text)),{memMB:s.memMB,line:(r.text||'').split('\n').pop()});
  await p.screenshot({path:(process.env.SHOTDIR||'shots')+'/m53-perfhud-on.png'});}
 else{ok('no flag: perfhud chunk never requested',!chunk,{chunk});ok('no flag: no window.__perf, no overlay',!r.perf&&!r.text,{perf:r.perf});}
 ok('no page errors ('+(flag?'on':'off')+')',errs.length===0,errs.slice(0,3));await p.close();}
console.log(fails?`QA-PERFHUD FAIL ${fails}`:'QA-PERFHUD PASS');await b.close();process.exit(fails?1:0);})().catch(e=>{console.log('QA-PERFHUD ERROR',e.message);process.exit(2)});
