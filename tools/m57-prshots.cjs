// M57 · image-quality review: Lite meadow / under-bridge / castle at pixel ratio 1.25, 1.0, 0.8 (same view, phone viewport
// 448x827 @2.25 like the Pixel 9), via the diag build's __diag.setPR. Writes raw PNGs to $DIR; compose with tools/m57-prcompose.py.
const PORT=process.env.PORT||'8095';const DIR=process.env.DIR||'/workspace/vale3d/logs/m57/pr';const fs=require('fs');fs.mkdirSync(DIR,{recursive:true});
const pc=require(process.env.PUPPETEER_CORE);const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:900000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const p=await b.newPage();await p.setViewport({width:448,height:827,deviceScaleFactor:2.25,isMobile:true,hasTouch:true});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(`http://localhost:${PORT}/?q=lite&qa=1`,{waitUntil:'domcontentloaded'});
 await p.evaluate(()=>{localStorage.clear();localStorage.setItem('vale3d-hero',JSON.stringify({name:'Ilka',sex:'female'}));localStorage.setItem('vale3d-save',JSON.stringify({v:1,started:true,done:false,xp:200,seals:{dawn:true},runes:[1,2,0],wind:true,warden:false,mirrors:[1,0,3,2],beacon:false,echo:false,charted:[true,true,false,true,false,false,false],cave:1,coast:0,sea:0,lamp:0,weapons:['rusty','spear'],weapon:'spear'}));});
 await p.goto(`http://localhost:${PORT}/diag/?q=lite&tod=0.42&qa=1&motion=fast`,{waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready&&window.__diag',{timeout:300000,polling:500});
 await p.evaluate(()=>{const t=document.getElementById('title');if(t&&!t.hidden)document.getElementById('tcont')?.click();});await sleep(2000);
 await p.addStyleTag({content:'#toast{display:none!important}'}); // transient DOM toasts (not affected by PR) would cover the detail crop
 const views={meadow:async()=>p.evaluate(()=>{window.__vale.warp(0,6);window.__vale.view(Math.PI,0,0.1,7);}),
  underbridge:async()=>p.evaluate(()=>{window.__vale.warp(-45,-55.9);window.__vale.view(0.7,0.7-Math.PI,0.25,4);}),
  castle:async()=>{await p.evaluate(()=>window.__vale.enterCastle('pale'));await p.waitForFunction("window.__vale.castle().inCastle&&!window.__vale.castle().fading",{timeout:120000,polling:300});await p.evaluate(()=>{const v=window.__vale;v.castlePeace();v.castleAt(0,2.6,0,Math.PI);v.view(Math.PI,0,-0.12,6.5);});}};
 const out=[];
 for(const [sc,go] of Object.entries(views)){await go();await sleep(4000);
  for(const pr of [1.25,1.0,0.8]){await p.evaluate(v=>window.__diag.setPR(v),pr);await go();await sleep(5000);
   const info=await p.evaluate(()=>{const c=document.querySelector('canvas');return {w:c.width,h:c.height};});const f=`${DIR}/${sc}-pr${pr.toFixed(2)}.png`;await p.screenshot({path:f});out.push({sc,pr,...info,f});console.log(sc,pr,JSON.stringify(info));}}
 console.log(errs.length?'ERRORS '+errs.slice(0,3).join(' | '):'no page errors');fs.writeFileSync(DIR+'/shots.json',JSON.stringify(out,null,1));await b.close();})().catch(e=>{console.log('ERR',e.message);process.exit(2)});
