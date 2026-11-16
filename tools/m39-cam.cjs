const pc=require(process.env.PUPPETEER_CORE);const sleep=t=>new Promise(r=>setTimeout(r,t));
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:600000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage();await p.setViewport({width:412,height:915,hasTouch:true,isMobile:true});
await p.goto('http://localhost:8090/?q=lite&shot='+process.env.SHOT,{waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(1500);
const E=(f,...a)=>p.evaluate(f,...a);
console.log(JSON.stringify(await E(()=>({c:__vale.castle&&{in:__vale.castle().inCastle,room:__vale.castle().room,O:__vale.castle().O,y:__vale.castle().y},cam:__vale.camInfo(),cave:__vale.cave().inCave,sea:__vale.sea().inSea}))));
if(process.env.JS){const r=await E(new Function('return ('+process.env.JS+')'));console.log('JS',JSON.stringify(r));await sleep(1200);await p.screenshot({path:'shots/'+process.env.OUT+'.png'});}
await b.close()})();
