const puppeteer=require(process.env.PUPPETEER_CORE);
(async()=>{const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:600000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage();await p.setViewport({width:1280,height:800});
await p.goto('http://localhost:8090/?q='+(process.argv[2]||'high')+'&shot='+(process.argv[3]||'spawn'),{waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});
await p.evaluate(()=>{const r=window.__vale.debug.renderer;const o=r.render.bind(r);window.__log=[];r.render=(sc,cam)=>{const b=r.info.render.triangles;o(sc,cam);const rt=r.getRenderTarget();window.__log.push([(sc.name||sc.type)+'/'+(cam.name||cam.type)+'/'+(rt?rt.width+'x'+rt.height:'screen')+(sc.overrideMaterial?'/ovr':''),r.info.render.triangles-b]);};});
await new Promise(r=>setTimeout(r,15000));
console.log(JSON.stringify(await p.evaluate(()=>{const m={};for(const [k,v] of window.__log.slice(-40)){m[k]=v}return m})));await b.close();})();
