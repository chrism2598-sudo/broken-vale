const puppeteer=require(process.env.PUPPETEER_CORE || 'puppeteer-core') /* npm i -D puppeteer-core, or set PUPPETEER_CORE */;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const [q='high',...names]=process.argv.slice(2);
(async()=>{
 const b=await puppeteer.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',protocolTimeout:600000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 for(const name of names){
  const p=await b.newPage();await p.setViewport({width:+(process.env.VW||1280),height:+(process.env.VH||800),deviceScaleFactor:1});
  const logs=[];p.on('console',m=>{if(['error','warning'].includes(m.type()))logs.push(m.type()+': '+m.text().slice(0,220));});p.on('pageerror',e=>logs.push('PAGEERR '+e.message.slice(0,220)));
  const t0=Date.now();
  await p.goto(`http://localhost:8090/?q=${q}&shot=${name}${process.env.EXTRA||''}`,{waitUntil:'load',timeout:120000});
  await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});
  await sleep(name==="run"?2500:6000);
  const info=await p.evaluate(()=>({fps:window.__vale.fps,tris:window.__vale.tris,framing:window.__vale.framing(),errors:window.__vale.errors}));
  await p.screenshot({path:`/workspace/vale3d/shots/${name}${q==="lite"?"-lite":""}${process.env.SUF||""}.png`});
  console.log(name,q,'load+settle s',((Date.now()-t0)/1000).toFixed(1),JSON.stringify(info),logs.slice(0,8).join(' | '));
  await p.close();
 }
 await b.close();
})().catch(e=>{console.log('ERR',e.message);process.exit(1)});
