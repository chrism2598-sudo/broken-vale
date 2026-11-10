const puppeteer=require(process.env.PUPPETEER_CORE||'puppeteer-core');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:600000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage();await p.setViewport({width:640,height:400});
await p.goto('http://localhost:8090/?q=high&shot=echo-grove',{timeout:120000});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(5000);
const sh=async n=>{await sleep(1200);await p.screenshot({path:'/tmp/hz-'+n+'.png'});};
await sh('base');
const info=await p.evaluate(()=>{const d=window.__vale.debug,c=d.camera;const out=[];const v=new (c.position.constructor)();d.scene.traverse(o=>{if(!o.visible)return;const m=o.material;if(!m||Array.isArray(m))return;if(m.transparent||m.blending===2){o.getWorldPosition(v);out.push([o.type,o.name,m.type,(o.layers.mask),v.distanceTo(c.position).toFixed(1),o.scale.x.toFixed(1)]);}});return {cam:c.position.toArray(),n:out.length,list:out.sort((a,b)=>a[4]-b[4]).slice(0,25)};});
console.log(JSON.stringify(info));
const P=await p.evaluate(()=>window.__vale.debug.composer.passes.map(x=>x.constructor.name));console.log(P);
for(let k=1;k<P.length;k++){await p.evaluate(k=>{window.__vale.debug.composer.passes.forEach((x,i)=>x.enabled=i!==k)},k);await sh('off'+k);}
await p.evaluate(()=>{window.__vale.debug.composer.passes.forEach(x=>x.enabled=true)});
await b.close();})();
