const puppeteer=require(process.env.PUPPETEER_CORE);
(async()=>{const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:600000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage();p.on('response',r=>{if(r.status()>=400)console.log(r.status(),r.url())});
await p.goto('http://localhost:8090/?q=lite&shot=spawn',{waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await b.close();})();
