const PORT=process.env.PORT||'8090';
// M54 · run the in-game 60 s measurement (?perf=1&perfrun=<scene>) headless, exactly as a player would open it (title →
// Continue is clicked by the overlay), save the results card screenshot, print the JSON (labelled HEADLESS ESTIMATE by
// the overlay itself), and check the perf run left the player's save untouched (read-only session).
// Usage: [QS=lite,high] [SCENES=meadow,castle,underbridge] node tools/m54-perfrun.cjs
const pc=require(process.env.PUPPETEER_CORE);const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const QS=(process.env.QS||'lite').split(','),SC=(process.env.SCENES||'meadow,castle,underbridge').split(','),DIR=process.env.SHOTDIR||'shots';
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:900000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 let bad=0;const out=[];
 for(const q of QS)for(const sc of SC){const p=await b.newPage();await p.setViewport({width:412,height:915,deviceScaleFactor:1,isMobile:true,hasTouch:true});const errs=[];p.on('pageerror',e=>errs.push(e.message));
  const SAVE=JSON.stringify({v:1,started:true,done:false,xp:321,seals:{dawn:true},runes:[0,0,0],wind:false,warden:false,mirrors:[0,0,0,0],beacon:false,echo:false,charted:[true,false,false,false,false,false,false],cave:0,coast:0,sea:0,lamp:0,weapons:['rusty'],weapon:'rusty'});
  await p.goto(`http://localhost:${PORT}/?q=${q}&qa=1`,{waitUntil:'load'});await p.evaluate(s=>{localStorage.clear();localStorage.setItem('vale3d-hero',JSON.stringify({name:'Ilka',sex:'female'}));localStorage.setItem('vale3d-save',s);},SAVE);
  try{await p.goto(`http://localhost:${PORT}/?q=${q}&perf=1&perfrun=${sc}`,{waitUntil:'load'});
   await p.waitForFunction('window.__perf&&window.__perf.result&&window.__perf.result()',{timeout:600000,polling:1000});
   const r=await p.evaluate(()=>window.__perf.result());await sleep(300);await p.screenshot({path:`${DIR}/m54-perfrun-${q}-${sc}.png`});
   const after=await p.evaluate(()=>localStorage.getItem('vale3d-save'));const untouched=after===SAVE;
   const ok=r.label==='HEADLESS ESTIMATE'&&r.frames>0&&r.drawCalls.avg>0&&untouched&&errs.length===0;if(!ok)bad++;
   console.log((ok?'PASS ':'FAIL ')+JSON.stringify({...r,device:{gpu:r.device.gpu,cores:r.device.cores,screen:r.device.screen},saveUntouched:untouched,errors:errs.slice(0,2)}));out.push(r);
  }catch(e){bad++;console.log('FAIL',q,sc,'CRASH',e.message.slice(0,200));}
  await p.close();}
 require('fs').writeFileSync(process.env.OUT||'/tmp/m54-perfrun.json',JSON.stringify(out,null,1));
 console.log(bad?`M54-PERFRUN FAIL ${bad}`:'M54-PERFRUN PASS');await b.close();process.exit(bad?1:0);})().catch(e=>{console.log('ERR',e.message);process.exit(2)});
