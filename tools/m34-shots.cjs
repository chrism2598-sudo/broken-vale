// M34 keep-interior shots. Usage: TAG=after PORT=8090 node tools/m34-shots.cjs [names...]
const pc=require(process.env.PUPPETEER_CORE||'puppeteer-core');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const T=process.env.TAG||'after', PORT=process.env.PORT||'8090';
const S={
  'hall-wide':{q:'q=lite&shot=m20-hall',w:5000,js:`__vale.warp(6000,2.6);__vale.view(Math.PI,0,-0.12,6.5)`},
  'hall-back':{q:'q=lite&shot=m20-hall',w:5000,js:`__vale.warp(6000,-6);__vale.view(0,0,-0.05,6.5)`},
  'hearth':{q:'q=lite&shot=m20-hall',w:5000,js:`__vale.warp(5996.2,-2.6);__vale.view(-Math.PI/2,Math.PI/2,0.1,3.6)`},
  'library':{q:'q=lite&shot=m20-hall',w:5000,js:`__vale.warp(6006.2,6.6);__vale.view(Math.PI/2,-Math.PI/2,-0.06,2.0)`},
  'chapel':{q:'q=lite&shot=m20-hall',w:5000,js:`__vale.warp(5993.8,7.0);__vale.view(-Math.PI/2,Math.PI/2,-0.06,2.0)`},
  'table':{q:'q=lite&shot=m20-hall',w:5000,js:`__vale.warp(6001.4,-0.8);__vale.view(0.57+Math.PI,0.57,0.4,2.2)`},
  'entry':{q:'q=lite&shot=m20-hall',w:5000,js:`__vale.warp(6000,9);__vale.view(Math.PI,0,0.0,3.5)`},
  'kitchen':{q:'q=lite&shot=m20-kitchen',w:6000},
  'hall-high':{q:'q=high&shot=m20-hall',w:6000,js:`__vale.warp(6000,2.6);__vale.view(Math.PI,0,-0.12,6.5)`},
};
const P={};for(const k in S)P['m34-'+T+'-'+k]=Object.assign({sex:'female',name:'Ilka'},S[k]);
(async()=>{
  const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:600000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const names=process.argv.slice(2); const list=names.length?names.map(n=>'m34-'+T+'-'+n):Object.keys(P);
  for(const name of list){ const pr=P[name]; if(!pr){console.log('unknown',name);continue;}
    const p=await b.newPage(); const logs=[]; p.on('pageerror',e=>logs.push('PE '+e.message)); p.on('console',m=>{if(m.type()==='error')logs.push('CE '+m.text().slice(0,220));});
    await p.setViewport({width:412,height:915,deviceScaleFactor:1,isMobile:true,hasTouch:true});
    await p.evaluateOnNewDocument((sex,nm)=>{localStorage.setItem('vale3d-hero',JSON.stringify({name:nm,sex}));},pr.sex,pr.name);
    await p.goto(`http://localhost:${PORT}/?${pr.q}`,{waitUntil:'load',timeout:120000});
    await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000}); await sleep(pr.w||3000);
    if(pr.js){await p.evaluate(pr.js); await p.evaluate(()=>window.__vale.sim(Array(45).fill(1/30),0,0));}
    await sleep(800); await p.screenshot({path:`/workspace/vale3d/shots/${name}.png`}); console.log(name, JSON.stringify(logs.slice(0,6))); await p.close(); }
  await b.close();
})().catch(e=>{console.error(e);process.exit(1);});
