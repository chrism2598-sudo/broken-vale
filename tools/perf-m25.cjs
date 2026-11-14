// M25 perf: per-frame tris / calls (Lite, phone portrait), adds a Pale Wing Gate road view. Usage: node tools/perf-m24.cjs [port]
const pc=require(process.env.PUPPETEER_CORE||'puppeteer-core');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const port=process.argv[2]||'8090';
const V={meadow:['q=lite&shot=spawn',''],paleWing:["q=lite&shot=spawn&tod=0.62","__vale.warp(-77.4,-104.1);__vale.view(Math.PI+0.604,0.604,-0.06,6)"],paleStair:["q=lite&shot=spawn&tod=0.62","__vale.warp(-75.0,-101.9);__vale.view(Math.PI+0.604,0.604,0.1,6)"],keep:['q=lite&shot=spawn&tod=0.62','__vale.warp(-6,-20);__vale.view(Math.PI+0.45,0.45,0.15,5.2)'],hall:['q=lite&shot=m20-hall',''],kitchen:['q=lite&shot=m20-kitchen','']};
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:600000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
for(const [name,[q,js]] of Object.entries(V)){const p=await b.newPage();await p.setViewport({width:412,height:915,deviceScaleFactor:1,isMobile:true,hasTouch:true});
  await p.goto(`http://localhost:${port}/?${q}`,{waitUntil:'load',timeout:120000});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(4000);
  if(js){await p.evaluate(js);await p.evaluate(()=>window.__vale.sim(Array(45).fill(1/30),0,0));}
  const r=await p.evaluate(()=>{const V=window.__vale;const a=V.bench(5);const c=V.bench(10);return {a,c};});
  const per=r.c.tris>r.a.tris*1.5?{tris:Math.round((r.c.tris-r.a.tris)/10),calls:Math.round((r.c.calls-r.a.calls)/10),cum:true}:{tris:r.c.tris,calls:r.c.calls};
  console.log(name,JSON.stringify(per));await p.close();}
await b.close();})().catch(e=>{console.error(e);process.exit(1);});
