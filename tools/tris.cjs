const puppeteer=require(process.env.PUPPETEER_CORE);
(async()=>{const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:600000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage();await p.setViewport({width:1280,height:800});
await p.goto('http://localhost:8090/?q='+(process.argv[2]||'high')+'&shot=spawn',{waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});
await new Promise(r=>setTimeout(r,4000));
const out=await p.evaluate(()=>{const s=window.__vale.debug.scene;const rows=[];s.traverse(o=>{if(!o.isMesh||!o.visible)return;let vis=true;let q=o;while(q){if(!q.visible)vis=false;q=q.parent}if(!vis)return;const g=o.geometry;const t=(g.index?g.index.count:g.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);let n=o.name||'';let q2=o.parent;while(!n&&q2){n=q2.name;q2=q2.parent}rows.push([Math.round(t),(n||o.material.type)+(o.isInstancedMesh?' [inst]':'')+' L'+o.layers.mask+(o.castShadow?' S':'')]);});rows.sort((a,b)=>b[0]-a[0]);const tot=rows.reduce((a,r)=>a+r[0],0);return {tot,top:rows.slice(0,25)}});
console.log(JSON.stringify(out));await b.close();})();
