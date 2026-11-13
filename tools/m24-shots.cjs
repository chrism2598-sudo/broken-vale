// M24 Pale Keep exterior shots (phone portrait). Usage: TAG=after PORT=8090 node tools/m24-shots.cjs [names...]
const pc=require(process.env.PUPPETEER_CORE||'puppeteer-core');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const T=process.env.TAG||'after', PORT=process.env.PORT||'8090';
// Pale Keep frame (world.ts: fromMap(95,70); landmarks.ts keepFrame)
const LX=2.6+(95-360)*0.36, LZ=-2.5+(70-420)*0.36, F=Math.atan2(0-LX,6-LZ), KX=LX-Math.sin(F)*3, KZ=LZ-Math.cos(F)*3;
const kp=(u,v)=>[KX+Math.cos(F)*u+Math.sin(F)*v, KZ-Math.sin(F)*u+Math.cos(F)*v];
const at=(u,v,yawOff,pitch,dist,faceOff=0)=>{const [x,z]=kp(u,v);return `__vale.warp(${x.toFixed(2)},${z.toFixed(2)});__vale.view(${(F+Math.PI+faceOff).toFixed(3)},${(F+yawOff).toFixed(3)},${pitch},${dist})`;};
const S={
  'approach':{q:'q=lite&shot=spawn&tod=0.62',js:at(0,58,0.12,-0.1,6)},
  'approach-low':{q:'q=lite&shot=spawn&tod=0.74',js:at(-6,44,-0.15,-0.12,6)},
  'wide':{q:'q=lite&shot=spawn&tod=0.4',js:at(28,80,0.35,0.05,7)},
  'gate':{q:'q=lite&shot=m20-gate',w:5000},
  'courtyard':{q:'q=lite&shot=spawn&tod=0.62',js:at(3,11.2,0.5,0.32,7.5)},
  'terrace':{q:'q=lite&shot=spawn&tod=0.62',js:at(9.5,9.5,0.9,0.28,7,-0.9)},
  'trough':{q:'q=lite&shot=spawn&tod=0.62',js:at(-8,8.5,-0.6,0.3,6,0.7)},
  'crown':{q:'q=lite&shot=spawn&tod=0.62',js:at(4,30,0.1,-0.42,5)},
  'wing-road':{q:'q=lite&shot=spawn&tod=0.4',js:at(1.5,52,0.1,-0.06,6)},
  'wing-close':{q:'q=lite&shot=spawn&tod=0.62',js:at(-2.5,40,-0.25,0.05,6)},
  'compass':{q:'q=lite&shot=spawn&tod=0.4',js:at(-1,37,0.0,-0.32,3.4)},
  'bird':{q:'q=lite&shot=spawn&tod=0.55',js:at(6,75,0.3,0.55,22)},
  'approach-high':{q:'q=high&shot=spawn&tod=0.62',js:at(0,58,0.12,-0.1,6)},
};
const P={};for(const k in S)P['m24-'+T+'-'+k]=Object.assign({sex:'female',name:'Ilka'},S[k]);
(async()=>{
  const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:600000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const names=process.argv.slice(2); const list=names.length?names.map(n=>'m24-'+T+'-'+n):Object.keys(P);
  for(const name of list){ const pr=P[name]; if(!pr){console.log('unknown',name);continue;}
    const p=await b.newPage(); const logs=[]; p.on('pageerror',e=>logs.push('PE '+e.message)); p.on('console',m=>{if(m.type()==='error')logs.push('CE '+m.text().slice(0,220));});
    await p.setViewport({width:412,height:915,deviceScaleFactor:1,isMobile:true,hasTouch:true});
    await p.evaluateOnNewDocument((sex,nm)=>{localStorage.setItem('vale3d-hero',JSON.stringify({name:nm,sex}));},pr.sex,pr.name);
    await p.goto(`http://localhost:${PORT}/?${pr.q}`,{waitUntil:'load',timeout:120000});
    await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000}); await sleep(pr.w||3000);
    if(pr.js){await p.evaluate(pr.js); await p.evaluate(()=>window.__vale.sim(Array(45).fill(1/30),0,0));}
    await sleep(1500); await p.screenshot({path:`/workspace/vale3d/shots/${name}.png`}); console.log(name, JSON.stringify(logs.slice(0,6))); await p.close(); }
  await b.close();
})().catch(e=>{console.error(e);process.exit(1);});
