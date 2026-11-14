// M26 opening-path shots (phone portrait). Usage: TAG=after PORT=8090 node tools/m26-shots.cjs [names...]
const pc=require(process.env.PUPPETEER_CORE||'puppeteer-core');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const T=process.env.TAG||'after', PORT=process.env.PORT||'8090';
// world views: v(x,z,heading,pitch,dist) — heading = direction the camera looks (atan2(dx,dz)); north = PI
const v=(x,z,h,pitch,dist)=>`__vale.warp(${x},${z});__vale.view(${h.toFixed(3)},${(h-Math.PI).toFixed(3)},${pitch},${dist})`;
const H=(x0,z0,x1,z1)=>Math.atan2(x1-x0,z1-z0);
const S={
  'hub-north':{q:'q=lite&shot=spawn&tod=0.4',js:v(0,6,Math.PI,0.1,7)},
  'hub-south':{q:'q=lite&shot=spawn&tod=0.4',js:v(0,6,0,0.08,7)},
  'ridge':{q:'q=lite&shot=spawn&tod=0.4',js:v(-22,32,H(-22,32,-26,60),0.02,7)},
  'falls-close':{q:'q=lite&shot=spawn&tod=0.4',js:v(-15.5,44,H(-15.5,44,-18,54),0.16,5)},
  'stair':{q:'q=lite&shot=spawn&tod=0.4',js:v(-35.6,47.8,H(-35.6,47.8,-34,62),0.08,5)},
  'ress':{q:'q=lite&shot=spawn&tod=0.4',js:v(-30.5,59.5,H(-30.5,59.5,-31.7,63),0.05,4)},
  'falls':{q:'q=lite&shot=spawn&tod=0.4',js:v(-15,39,H(-15,39,-18,56),0.12,7)},
  'track':{q:'q=lite&shot=spawn&tod=0.4',js:v(-12,24,H(-12,24,-28,46),0.12,7)},
  'bridge':{q:'q=lite&shot=spawn&tod=0.4',js:v(-40,-52,H(-40,-52,-52,-60),0.1,8)},
  'pale-road':{q:'q=lite&shot=spawn&tod=0.4',js:v(-66,-70,H(-66,-70,-74,-101),0.1,7)},
  'bridge-side':{q:'q=lite&shot=spawn&tod=0.4',js:v(-46,-68,H(-46,-68,-52,-59.6),0.1,7)},
  'echo-close':{q:'q=lite&shot=spawn&tod=0.4',js:v(12,-34,H(12,-34,31.4,-45.7),0.2,6)},
  'echo-high':{q:'q=high&shot=spawn&tod=0.4',js:v(22,-38,H(22,-38,31.4,-45.7),0.12,5)},
  'shrine-close':{q:'q=lite&shot=spawn&tod=0.4',js:v(-25,-40,H(-25,-40,-34,-46),0.1,5)},
  'shrine-pillar':{q:'q=lite&shot=spawn&tod=0.4',js:v(-26.5,-39.5,H(-26.5,-39.5,-31.7,-43.7),0.12,4.5)},
  'river':{q:'q=lite&shot=spawn&tod=0.4',js:v(-40,-40,H(-40,-40,-50,-58),0.15,6)},
  'river-high':{q:'q=high&shot=spawn&tod=0.4',js:v(-40,-40,H(-40,-40,-50,-58),0.15,6)},
  'road':{q:'q=lite&shot=spawn&tod=0.4',js:v(-68.6,-72,H(-68.6,-72,-72,-95),0.14,5)},
  'road-low':{q:'q=lite&shot=spawn&tod=0.4',js:v(-71.6,-80,H(-71.6,-80,-71.2,-90),0.3,4)},
  'west-rune':{q:'q=lite&shot=spawn&tod=0.4',js:v(-44.6,-41.5,H(-44.6,-41.5,-44.6,-46),0.06,3.4)},
  'castle-road':{q:'q=lite&shot=spawn&tod=0.4',js:v(-64,-70,H(-64,-70,-80,-112),0.2,5)},
  'plaza-up':{q:'q=lite&shot=spawn&tod=0.62',js:v(-77.4,-104.1,H(-77.4,-104.1,-91.8,-128.5),-0.12,5)},
  'stair-side':{q:'q=lite&shot=spawn&tod=0.62',js:v(-78.0,-105.9,H(-78.0,-105.9,-82.7,-102.5),0.3,3.0)},
  'plaza-rock-l':{q:'q=lite&shot=spawn&tod=0.62',js:v(-76.5,-100.5,H(-76.5,-100.5,-88,-103.7),-0.15,4.5)},
  'plaza-rock-r':{q:'q=lite&shot=spawn&tod=0.62',js:v(-73.5,-103.5,H(-73.5,-103.5,-71.1,-114.4),-0.15,4.5)},
  'cut-up':{q:'q=lite&shot=spawn&tod=0.62',js:v(-79.0,-108.2,H(-79.0,-108.2,-91.8,-128.5),-0.12,4)},
  'cut-side':{q:'q=lite&shot=spawn&tod=0.62',js:v(-80.6,-109.6,H(-80.6,-109.6,-71.6,-115.2),-0.05,2.6)},
  'stair-up':{q:'q=lite&shot=spawn&tod=0.62',js:v(-75.0,-101.9,H(-75.0,-101.9,-91.8,-128.5),0.05,5)},
  'rock-side':{q:'q=lite&shot=spawn&tod=0.62',js:v(-64,-111,H(-64,-111,-91.8,-128.5),0.18,4.5)},
  'stair-mid':{q:'q=lite&shot=spawn&tod=0.62',js:v(-79.2,-107.6,H(-79.2,-107.6,-75.0,-110.3),0.3,3.0)},
  'hub-ground':{q:'q=lite&shot=spawn&tod=0.4',js:v(6,4,H(6,4,2.6,-2.5),0.35,5)},
  'echo':{q:'q=lite&shot=spawn&tod=0.4',js:v(14,-30,H(14,-30,31,-46),0.06,7)},
  'shrine':{q:'q=lite&shot=spawn&tod=0.4',js:v(-18,-34,H(-18,-34,-34,-46),0.06,7)},
  'bird':{q:'q=lite&shot=spawn&tod=0.4',js:v(-14,30,Math.PI+0.3,0.62,22)},
  'ridge-high':{q:'q=high&shot=spawn&tod=0.4',js:v(-22,32,H(-22,32,-26,60),0.02,7)},
};
const P={};for(const k in S)P['m26-'+T+'-'+k]=Object.assign({sex:'female',name:'Ilka'},S[k]);
(async()=>{
  const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:600000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const names=process.argv.slice(2); const list=names.length?names.map(n=>'m26-'+T+'-'+n):Object.keys(P);
  for(const name of list){ const pr=P[name]; if(!pr){console.log('unknown',name);continue;}
    const p=await b.newPage(); const logs=[]; p.on('pageerror',e=>logs.push('PE '+e.message)); p.on('console',m=>{if(m.type()==='error')logs.push('CE '+m.text().slice(0,220));});
    await p.setViewport({width:412,height:915,deviceScaleFactor:1,isMobile:true,hasTouch:true});
    await p.evaluateOnNewDocument((sex,nm)=>{localStorage.setItem('vale3d-hero',JSON.stringify({name:nm,sex}));},pr.sex,pr.name);
    await p.goto(`http://localhost:${PORT}/?${pr.q}`,{waitUntil:'load',timeout:120000});
    await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000}); await sleep(pr.w||3000);
    if(pr.js){await p.evaluate(pr.js); await p.evaluate(()=>window.__vale.sim(Array(45).fill(1/30),0,0));}
    await p.evaluate(()=>{for(const e of document.querySelectorAll('.toast,#toast,[class*=toast]'))e.style.display='none';}).catch(()=>{}); await sleep(5200); await p.evaluate(()=>{for(const e of document.querySelectorAll('.toast,#toast,[class*=toast]'))e.style.display='none';}).catch(()=>{}); await p.screenshot({path:`/workspace/vale3d/shots/${name}.png`}); console.log(name, JSON.stringify(logs.slice(0,6))); await p.close(); }
  await b.close();
})().catch(e=>{console.error(e);process.exit(1);});
