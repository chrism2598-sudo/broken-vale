// M20a perf: frame cost (sim + render + readback) in the meadow vs the keep interior / lookout, Lite at phone size under 5× CPU throttle.
const pc=require(process.env.PUPPETEER_CORE||'puppeteer-core');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await pc.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',protocolTimeout:600000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});const out={};
for(const [name,shot] of [['meadow','spawn'],['keep-hall','m20-hall'],['keep-lookout','m20-lookout'],['keep-fight','m20-fight']]){const p=await b.newPage();await p.setViewport({width:412,height:915,deviceScaleFactor:1,isMobile:true,hasTouch:true});
  await p.goto(`http://localhost:8090/?q=lite${shot?'&shot='+shot:''}`,{waitUntil:'load',timeout:120000});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(4000);
  if(!shot){await p.evaluate(()=>{const n=document.querySelector('#begin')||document.querySelector('#start');n&&n.click();});await sleep(1500);}
  const cdp=await p.target().createCDPSession();await cdp.send('Emulation.setCPUThrottlingRate',{rate:5});await sleep(1500);
  await p.evaluate(()=>window.__vale.bench(10));const r=await p.evaluate(()=>window.__vale.bench(60));out[name]=Object.fromEntries(Object.entries(r).map(([k,v])=>[k,+v.toFixed(1)]));
  console.log(name,JSON.stringify(out[name]));await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});await p.close();}
console.log('hall/meadow',(out['keep-hall'].avg/out.meadow.avg).toFixed(2),'lookout/meadow',(out['keep-lookout'].avg/out.meadow.avg).toFixed(2),'fight/meadow',(out['keep-fight'].avg/out.meadow.avg).toFixed(2));await b.close();})();
