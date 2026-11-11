// M19 phone-portrait Lite shots: buttons (Warden fight, blocking), weapons (picker + pickup), journal clue.
const pc=require(process.env.PUPPETEER_CORE||'puppeteer-core');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const W=412,H=915,only=process.argv.slice(2);
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:600000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const go=async(name,shot)=>{if(only.length&&!only.includes(name))return;const p=await b.newPage();const logs=[];p.on('pageerror',e=>logs.push('PE '+e.message));p.on('console',m=>{if(m.type()==='error')logs.push('CE '+m.text().slice(0,200));});
  await p.setViewport({width:W,height:H,deviceScaleFactor:1,isMobile:true,hasTouch:true});await p.goto(`http://localhost:8090/?q=lite&shot=${shot}`,{waitUntil:'load',timeout:120000});
  await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(4500);
  const info=await p.evaluate(()=>({c:window.__vale.combat(),near:window.__vale.quest().near,errors:window.__vale.errors}));
  await p.screenshot({path:`/workspace/vale3d/shots/${name}.png`});console.log(name,JSON.stringify({info,logs:logs.slice(0,6)}));await p.close();};
 await go('m19-buttons','m19-buttons');await go('m19-weapons','m19-weapons');await go('m19-journal-clue','m19-journal');await b.close();})();
