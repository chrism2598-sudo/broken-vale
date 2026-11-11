// M20b phone-portrait shots: node tools/m20b-shots.cjs name... ; each preset = URL query + optional setup in page.
const pc=require(process.env.PUPPETEER_CORE||'puppeteer-core');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const P={
 'm20b-night-camp':{q:'q=lite&shot=spawn&tod=0.94',js:`__vale.warp(9.5,6.8);__vale.view(-2.3,-2.3+Math.PI,0.22,5.4)`},
 'm20b-night-road':{q:'q=lite&shot=spawn&tod=0.95',js:`__vale.warp(-6,-20);__vale.view(Math.PI+0.45,0.45,0.2,5.6)`},
 'm20b-dusk':{q:'q=lite&shot=spawn&tod=0.765',js:`__vale.warp(2,8);__vale.view(Math.PI,0,0.12,6)`},
 'm20b-day':{q:'q=lite&shot=spawn&tod=0.42',js:`__vale.warp(2,8);__vale.view(Math.PI,0,0.12,6)`},
 'm20b-arena':{w:9000,q:'q=lite&shot=keeper',js:`__vale.warp(4000+15.5,4000+5.5);__vale.view(Math.atan2(-15.5,-5.5),Math.atan2(-15.5,-5.5)+Math.PI,0.2,7.5)`},
 'm20b-sun-bug':{q:'q=lite&shot=epilogue&tod=0.45',js:`__vale.warp(-92.8+5,83.9+19);__vale.view(1.75,1.75+Math.PI-0.35,0.15,5.2)`},
 'm20b-sun-wide':{q:'q=lite&shot=epilogue&tod=0.45',js:`__vale.warp(-92.8-14,83.9+14);__vale.view(-2.36,-2.36+Math.PI,0.12,6)`},
 'm20b-sun-out':{q:'q=lite&shot=epilogue&tod=0.45',js:`__vale.warp(-92.8+15,83.9+2);__vale.view(1.6,1.6+Math.PI,0.1,5)`},
 'm20b-jump':{q:'q=lite&shot=epilogue&tod=0.45',js:`__vale.warp(-92.8+3,83.9+24.5);__vale.view(0.5,0.5+Math.PI-0.5,0.12,5.2)`,post:`__vale.jump();__vale.sim(Array(14).fill(1/60),0,0);__vale.holdAir(true)`},
 'm20b-arena-close':{q:'q=lite&shot=keeper',js:''},
 'm20b-grotto':{q:'q=lite&shot=seal-open',js:`__vale.warp(3000-9.5,3000+13.5);__vale.view(0,Math.PI,0.18,5)`},
 'm20b-grotto-in':{q:'q=lite&shot=seal-open',js:`__vale.warp(3000-8.5,3000+20.5);__vale.view(0.6,0.6+Math.PI,0.25,4.5)`},
};
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:600000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 for(const name of process.argv.slice(2)){const pr=P[name];const p=await b.newPage();const logs=[];p.on('pageerror',e=>logs.push('PE '+e.message));p.on('console',m=>{if(m.type()==='error')logs.push('CE '+m.text().slice(0,200));});
  await p.setViewport({width:412,height:915,deviceScaleFactor:1,isMobile:true,hasTouch:true});await p.goto(`http://localhost:8090/?${pr.q}`,{waitUntil:'load',timeout:120000});
  await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(pr.w||3000);
  if(pr.js){await p.evaluate(pr.js);await p.evaluate(()=>window.__vale.sim(Array(45).fill(1/30),0,0));}
  if(pr.post){await sleep(1500);await p.evaluate(pr.post);}
  if(!pr.post)await sleep(2500);const info=await p.evaluate(()=>{const w=window.__vale.world();return {tod:w.tod,night:w.night,exp:w.exposure,sun:w.sunI,lantern:w.lantern,near:w.near,g:w.groups.filter(g=>g.near&&g.present).map(g=>g.id+':'+g.mobs.filter(m=>m.alive).length),k:window.__vale.keeper&&window.__vale.keeper().state,errors:window.__vale.errors};});
  await p.screenshot({path:`/workspace/vale3d/shots/${name}.png`});console.log(name,JSON.stringify({info,logs:logs.slice(0,6)}));await p.close();}
 await b.close();})();
