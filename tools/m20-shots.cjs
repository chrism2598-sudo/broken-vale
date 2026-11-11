// M20 phone-portrait Lite shots: node tools/m20-shots.cjs m20-hall m20-lookout ...  (preset name = shot name)
const pc=require(process.env.PUPPETEER_CORE||'puppeteer-core');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const W=412,H=915,names=process.argv.slice(2);
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:600000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 for(const name of names){const p=await b.newPage();const logs=[];p.on('pageerror',e=>logs.push('PE '+e.message));p.on('console',m=>{if(m.type()==='error')logs.push('CE '+m.text().slice(0,200));});
  await p.setViewport({width:W,height:H,deviceScaleFactor:1,isMobile:true,hasTouch:true});await p.goto(`http://localhost:8090/?q=lite&shot=${name}`,{waitUntil:'load',timeout:120000});
  await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(6000);
  const info=await p.evaluate(()=>{const c=window.__vale.castle();return {in:c.inCastle,id:c.id,y:c.y,room:c.room,perch:c.perch,near:c.near,mobs:c.mobs.map(m=>m.state+':'+m.hp),errors:window.__vale.errors};});
  await p.screenshot({path:`/workspace/vale3d/shots/${name}.png`});console.log(name,JSON.stringify({info,logs:logs.slice(0,6)}));await p.close();}
 await b.close();})();
