// M21b-2 phone-portrait shots of the expanded Listening Pools.
const pc=require(process.env.PUPPETEER_CORE||'puppeteer-core');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const P={
 'm21b2-pools':{q:'q=lite&shot=sea-cave-interior',w:5000,js:`__vale.view(-Math.PI/2,Math.PI/2,0.18,7)`},
 'm21b2-wrack':{q:'q=lite&shot=seal-open',js:`__vale.killSeaMobs();__vale.warp(3000-9.5,3000+20.5);__vale.view(0.5,0.5+Math.PI,0.22,4.8)`},
 'm21b2-flood-mouth':{q:'q=lite&shot=seal-open',js:`__vale.killSeaMobs();__vale.warp(3000-26.4,3000+8.5);__vale.view(0,Math.PI,0.2,5)`},
 'm21b2-flood':{q:'q=lite&shot=seal-open',js:`__vale.killSeaMobs();__vale.warp(3000-26.4,3000+20.4);__vale.view(0,Math.PI,0.22,5.6)`},
 'm21b2-flood-chest':{q:'q=lite&shot=seal-open',js:`__vale.killSeaMobs();__vale.warp(3000-26.0,3000+26.5);__vale.view(0,Math.PI,0.28,4.6)`},
 'm21b2-crystal-mouth':{q:'q=lite&shot=seal-open',js:`__vale.killSeaMobs();__vale.warp(3000-5.5,3000-8.0);__vale.view(Math.PI,0,0.2,5)`},
 'm21b2-crystal':{q:'q=lite&shot=seal-open',js:`__vale.killSeaMobs();__vale.warp(3000-5.5,3000-21.6);__vale.view(Math.PI,0,0.18,5.6)`},
 'm21b2-crystal-tablet':{q:'q=lite&shot=seal-open',js:`__vale.killSeaMobs();__vale.warp(3000-5.35,3000-22.4);__vale.view(Math.PI,0,0.22,4.6)`},
 'm21b2-wight':{q:'q=lite&shot=seal-open',js:`(()=>{const m=(__vale.sea().mobs||[]).find(q=>q.id==='sea-flood-a');if(m){__vale.warp(m.x+2.4,m.z+0.4);__vale.view(Math.atan2(m.x-(m.x+2.4),m.z-(m.z+0.4)),Math.atan2(m.x-(m.x+2.4),m.z-(m.z+0.4))+Math.PI,0.18,5.2);}})()`},
 'm21b2-keeper':{q:'q=lite&shot=keeper',w:8000},
};
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:600000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 for(const name of process.argv.slice(2)){const pr=P[name];if(!pr){console.log('unknown',name);continue;}const p=await b.newPage();const logs=[];p.on('pageerror',e=>logs.push('PE '+e.message));p.on('console',m=>{if(m.type()==='error')logs.push('CE '+m.text().slice(0,200));});
  await p.setViewport({width:412,height:915,deviceScaleFactor:1,isMobile:true,hasTouch:true});await p.goto(`http://localhost:8090/?${pr.q}`,{waitUntil:'load',timeout:120000});
  await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(pr.w||3000);
  if(pr.js){await p.evaluate(pr.js);await p.evaluate(()=>window.__vale.sim(Array(45).fill(1/30),0,0));}
  await sleep(2500);const info=await p.evaluate(()=>{const s=window.__vale.sea();const k=window.__vale.keeper();return {inSea:s.inSea,chamber:s.chamber,near:window.__vale.world().near,mobs:(s.mobs||[]).map(m=>m.id+':'+m.state),k:k.state,cam:window.__vale.camInfo()};});
  await p.screenshot({path:`/workspace/vale3d/shots/${name}${process.env.TAG||''}.png`});console.log(name,JSON.stringify({info,logs:logs.slice(0,6)}));await p.close();}
 await b.close();})();
