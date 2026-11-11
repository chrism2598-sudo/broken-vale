// M20b phone-portrait shots: node tools/m20b-shots.cjs name... ; each preset = URL query + optional setup in page.
const pc=require(process.env.PUPPETEER_CORE||'puppeteer-core');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const P={
 'm20b2-arena-wide':{w:9000,q:'q=lite&shot=keeper',js:'',post:`(()=>{const V=__vale;V.warp(4000+17,4000+13);const f=Math.atan2(-17,-13);V.view(f,f+Math.PI,0.62,15);V.sim(Array(20).fill(1/30),0,0);return V.camInfo();})()`},
 'm20b2-banners':{q:'q=lite&shot=epilogue&tod=0.45',js:`__vale.warp(-92.8+17,83.9+17);__vale.view(-2.36,-2.36+Math.PI,0.1,7)`},
 'm20b2-autumn':{q:'q=lite&shot=spawn&tod=0.45',js:`__vale.warp(0,10);__vale.view(2.2,2.2+Math.PI,0.1,5)`},
 'm20b2-autumn-far':{q:'q=lite&shot=spawn&tod=0.62',js:`__vale.warp(-4,-24);__vale.view(2.6,2.6+Math.PI,0.12,5)`},
 'm20b2-tower':{q:'q=lite&shot=spawn&tod=0.45',js:`__vale.warp(165-13,-40+9);__vale.view(Math.atan2(13,-9),Math.atan2(13,-9)+Math.PI,0.12,6.5)`},
 'm20b2-camp':{q:'q=lite&shot=spawn&tod=0.45',js:`__vale.warp(-122+5,148-17);__vale.view(Math.atan2(-5,17),Math.atan2(-5,17)+Math.PI,0.2,6.5)`},
 'm20b2-barrow-door':{q:'q=lite&shot=spawn&tod=0.45',js:`(()=>{const d=__vale.spots().find(s=>s.id==='barrow-door');const dx=d.x-(-152),dz=d.z-(-108),l=Math.hypot(dx,dz);__vale.warp(d.x+dx/l*6,d.z+dz/l*6);const f=Math.atan2(-dx,-dz);__vale.view(f,f+Math.PI,0.15,5.5);})()`},
 'm20b2-barrow-hall':{q:'q=lite&shot=spawn&tod=0.45',js:'',post:`__vale.barrowGo('enter').then(()=>{const V=__vale;V.barrowWarp(0,4);V.view(0,Math.PI,0.22,5);V.sim(Array(30).fill(1/30),0,0);})`},
 'm20b2-barrow-king':{q:'q=lite&shot=spawn&tod=0.45',js:'',post:`__vale.barrowGo('enter').then(()=>{const V=__vale;V.setSq({barrow:1});return V.barrowGo('exit');}).then(()=>__vale.barrowGo('enter')).then(()=>{const V=__vale;V.barrowWarp(0,29.5);V.view(0,Math.PI,0.2,5.5);V.sim(Array(6).fill(1/30),0,0);})`},
 'm20b2-bluff':{q:'q=lite&shot=spawn&tod=0.7',js:`__vale.warp(128-4,150-4);__vale.view(0.8,0.8+Math.PI,0.05,5)`},
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
