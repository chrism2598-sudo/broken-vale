// M20b phone-portrait shots: node tools/m20b-shots.cjs name... ; each preset = URL query + optional setup in page.
const pc=require(process.env.PUPPETEER_CORE||'puppeteer-core');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const P={
 'm21-meadow':{q:'q=lite&shot=spawn&tod=0.42',js:`__vale.warp(2,8);__vale.view(Math.PI,0,0.12,6)`},
 'm21-keep':{q:'q=lite&shot=spawn&tod=0.62',js:`__vale.warp(-6,-20);__vale.view(Math.PI+0.45,0.45,0.15,5.6)`},
 'm21-night-road':{q:'q=lite&shot=spawn&tod=0.95',js:`__vale.warp(-6,-20);__vale.view(Math.PI+0.45,0.45,0.2,5.6)`},
 'm21-camp':{q:'q=lite&shot=spawn&tod=0.45',js:`__vale.warp(-122+5,148-17);__vale.view(Math.atan2(-5,17),Math.atan2(-5,17)+Math.PI,0.2,6.5)`},
 'm21-shelf':{q:'q=lite&shot=m20-shelf',w:6000},'m21-shelfopen':{q:'q=lite&shot=m20-shelfopen',w:6000},'m21-gate':{q:'q=lite&shot=m20-gate',w:6000},'m21-hall':{q:'q=lite&shot=m20-hall',w:6000},
 'm21-stairs':{q:'q=lite&shot=m20-stairs',w:6000},'m21-door':{q:'q=lite&shot=m20-door',w:6000},'m21-keeper':{q:'q=lite&shot=keeper',w:8000},
};
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:600000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 for(const name of process.argv.slice(2)){const pr=P[name];const p=await b.newPage();const logs=[];p.on('pageerror',e=>logs.push('PE '+e.message));p.on('console',m=>{if(m.type()==='error')logs.push('CE '+m.text().slice(0,200));});
  await p.setViewport({width:412,height:915,deviceScaleFactor:1,isMobile:true,hasTouch:true});await p.goto(`http://localhost:8090/?${pr.q}`,{waitUntil:'load',timeout:120000});
  await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(pr.w||3000);
  if(pr.js){await p.evaluate(pr.js);await p.evaluate(()=>window.__vale.sim(Array(45).fill(1/30),0,0));}
  if(pr.post){await sleep(1500);await p.evaluate(pr.post);}
  if(!pr.post)await sleep(2500);const info=await p.evaluate(()=>{const w=window.__vale.world();return {tod:w.tod,night:w.night,exp:w.exposure,sun:w.sunI,lantern:w.lantern,near:w.near,g:w.groups.filter(g=>g.near&&g.present).map(g=>g.id+':'+g.mobs.filter(m=>m.alive).length),k:window.__vale.keeper&&window.__vale.keeper().state,errors:window.__vale.errors};});
  await p.screenshot({path:`/workspace/vale3d/shots/${name}${process.env.TAG||''}.png`});console.log(name,JSON.stringify({info,logs:logs.slice(0,6)}));await p.close();}
 await b.close();})();
