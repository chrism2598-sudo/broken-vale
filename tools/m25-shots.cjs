// M25 Pale rock + grand stair shots (phone portrait). Usage: TAG=after PORT=8090 node tools/m25-shots.cjs [names...]
const pc=require(process.env.PUPPETEER_CORE||'puppeteer-core');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const T=process.env.TAG||'after', PORT=process.env.PORT||'8090';
// Pale Keep frame (world.ts: fromMap(95,70); landmarks.ts keepFrame)
const LX=2.6+(95-360)*0.36, LZ=-2.5+(70-420)*0.36, F=Math.atan2(0-LX,6-LZ), KX=LX-Math.sin(F)*3, KZ=LZ-Math.cos(F)*3;
const kp=(u,v)=>[KX+Math.cos(F)*u+Math.sin(F)*v, KZ-Math.sin(F)*u+Math.cos(F)*v];
const at=(u,v,yawOff,pitch,dist,faceOff=0)=>{const [x,z]=kp(u,v);return `__vale.warp(${x.toFixed(2)},${z.toFixed(2)});__vale.view(${(F+Math.PI+faceOff).toFixed(3)},${(F+yawOff).toFixed(3)},${pitch},${dist})`;};
const S={ // kp v = distance from the landmark centre + 3 (stair treads: v 23.8..34.6, Wing Gate v 36)
  'approach':{q:'q=lite&shot=spawn&tod=0.62',js:at(9,54,0.3,0.1,9,0.2)},
  'gate-stair':{q:'q=lite&shot=spawn&tod=0.62',js:at(0.3,38.5,0.05,0.16,6)},
  'stair-mid':{q:'q=lite&shot=spawn&tod=0.62',js:at(0.8,29.2,0.55,0.18,7)},
  'top-down':{q:'q=lite&shot=spawn&tod=0.62',js:at(1.8,24.6,Math.PI+0.7,0.42,6,-Math.PI)},
  'crown':{q:'q=lite&shot=spawn&tod=0.62',js:at(1.2,15.5,0.12,-0.3,5.5)},
  'side':{q:'q=lite&shot=spawn&tod=0.4',js:at(-24,48,-0.55,0.08,9,-0.5)},
  'wide':{q:'q=lite&shot=spawn&tod=0.4',js:at(28,80,0.35,0.05,7)},
  'approach-high':{q:'q=high&shot=spawn&tod=0.62',js:at(9,54,0.3,0.1,9,0.2)},
  'stair-high':{q:'q=high&shot=spawn&tod=0.62',js:at(0.8,29.2,0.55,0.18,7)},
};
const P={};for(const k in S)P['m25-'+T+'-'+k]=Object.assign({sex:'female',name:'Ilka'},S[k]);
(async()=>{
  const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:600000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const names=process.argv.slice(2); const list=names.length?names.map(n=>'m25-'+T+'-'+n):Object.keys(P);
  for(const name of list){ const pr=P[name]; if(!pr){console.log('unknown',name);continue;}
    const p=await b.newPage(); const logs=[]; p.on('pageerror',e=>logs.push('PE '+e.message)); p.on('console',m=>{if(m.type()==='error')logs.push('CE '+m.text().slice(0,220));});
    await p.setViewport({width:412,height:915,deviceScaleFactor:1,isMobile:true,hasTouch:true});
    await p.evaluateOnNewDocument((sex,nm)=>{localStorage.setItem('vale3d-hero',JSON.stringify({name:nm,sex}));},pr.sex,pr.name);
    await p.goto(`http://localhost:${PORT}/?${pr.q}`,{waitUntil:'load',timeout:120000});
    await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000}); await sleep(pr.w||3000);
    if(pr.js){await p.evaluate(pr.js); await p.evaluate(()=>window.__vale.sim(Array(45).fill(1/30),0,0));}
    await sleep(5200); await p.screenshot({path:`/workspace/vale3d/shots/${name}.png`}); console.log(name, JSON.stringify(logs.slice(0,6))); await p.close(); }
  await b.close();
})().catch(e=>{console.error(e);process.exit(1);});
