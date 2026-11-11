// M21b-3b phone-portrait hero shots.
const pc=require(process.env.PUPPETEER_CORE||'puppeteer-core');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const P={
  'm21b3b-female-meadow':{sex:'female',name:'Ilka',q:'q=lite&shot=spawn&tod=0.42',js:`__vale.warp(2,8);__vale.view(Math.PI,0,0.12,5.2)`},
  'm21b3b-male-meadow':{sex:'male',name:'Aren',q:'q=lite&shot=spawn&tod=0.42',js:`__vale.warp(2,8);__vale.view(Math.PI,0,0.12,5.2)`},
  'm21b3b-keep':{sex:'female',name:'Ilka',q:'q=lite&shot=spawn&tod=0.62',js:`__vale.warp(-6,-20);__vale.view(Math.PI+0.45,0.45,0.15,5.2)`},
  'm21b3b-run':{sex:'female',name:'Ilka',q:'q=lite&shot=run&tod=0.42',js:`__vale.warp(2,8);__vale.view(Math.PI,0,0.14,5.6)`,w:3500},
};
(async()=>{
  const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:600000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const names=process.argv.slice(2);
  const list=names.length?names:Object.keys(P);
  for(const name of list){
    const pr=P[name]; if(!pr){console.log('unknown',name);continue;}
    const p=await b.newPage(); const logs=[];
    p.on('pageerror',e=>logs.push('PE '+e.message));
    p.on('console',m=>{if(m.type()==='error')logs.push('CE '+m.text().slice(0,220));});
    await p.setViewport({width:412,height:915,deviceScaleFactor:1,isMobile:true,hasTouch:true});
    await p.evaluateOnNewDocument((sex,nm)=>{localStorage.setItem('vale3d-hero',JSON.stringify({name:nm,sex}));},pr.sex,pr.name);
    await p.goto(`http://localhost:8090/?${pr.q}`,{waitUntil:'load',timeout:120000});
    await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});
    await sleep(pr.w||3000);
    if(pr.js){await p.evaluate(pr.js); await p.evaluate(()=>window.__vale.sim(Array(45).fill(1/30),0,0));}
    // run: keep holding forward a bit longer so the gait is mid-stride
    if(name==='m21b3b-run'){await p.evaluate(()=>{const V=window.__vale; V.sim(Array(40).fill(1/30),0,-1);});}
    await sleep(800);
    const info=await p.evaluate(()=>{
      const V=window.__vale;
      return {profile:V.profile, pose:V.pose(), cam:V.camInfo(), vis:V.camInfo().vis, errors:V.errors, fps:V.fps, tris:V.tris};
    });
    await p.screenshot({path:`/workspace/vale3d/shots/${name}.png`});
    console.log(name, JSON.stringify({info,logs:logs.slice(0,8)}));
    await p.close();
  }
  await b.close();
})().catch(e=>{console.error(e);process.exit(1);});
