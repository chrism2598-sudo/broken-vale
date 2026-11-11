// M21b-3b phone-portrait hero shots.
const pc=require(process.env.PUPPETEER_CORE||'puppeteer-core');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const T=process.env.TAG||'after';
const S={
  'meadow':{q:'q=lite&shot=spawn&tod=0.42',js:`__vale.warp(2,8);__vale.view(Math.PI,0,0.12,5.2)`},
  'keep':{q:'q=lite&shot=spawn&tod=0.62',js:`__vale.warp(-6,-20);__vale.view(Math.PI+0.45,0.45,0.15,5.2)`},
  'hall':{q:'q=lite&shot=m20-hall',w:6000},'stairs':{q:'q=lite&shot=m20-stairs',w:6000},
  'kitchen':{q:'q=lite&shot=m20-kitchen',w:6000},'cellar':{q:'q=lite&shot=m20-cellar',w:6000},
  'flood-chest':{q:'q=lite&shot=seal-open',js:`__vale.killSeaMobs();__vale.warp(3000-26.0,3000+26.5);__vale.view(0,Math.PI,0.28,4.6)`},
  'flood':{q:'q=lite&shot=seal-open',js:`__vale.killSeaMobs();__vale.warp(3000-26.4,3000+20.4);__vale.view(0,Math.PI,0.22,5.6)`},
  'crystal':{q:'q=lite&shot=seal-open',js:`__vale.killSeaMobs();__vale.warp(3000-5.5,3000-21.6);__vale.view(Math.PI,0,0.18,5.6)`},
  'crystal-tablet':{q:'q=lite&shot=seal-open',js:`__vale.killSeaMobs();__vale.warp(3000-5.35,3000-22.4);__vale.view(Math.PI,0,0.22,4.6)`},
};
const P={};for(const k in S)P['m22-'+T+'-'+k]=Object.assign({sex:'female',name:'Ilka'},S[k]);
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
    if(0){await p.evaluate(()=>{const V=window.__vale; V.sim(Array(40).fill(1/30),0,-1);});}
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
