const pc=require(process.env.PUPPETEER_CORE);const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:600000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage();await p.setViewport({width:412,height:915,deviceScaleFactor:1,isMobile:true,hasTouch:true});
await p.goto('http://localhost:8090/?'+(process.env.Q||'q=lite&shot=spawn&tod=0.4'),{waitUntil:'load',timeout:120000});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(4000);
await p.evaluate(process.env.JS);await p.evaluate(()=>window.__vale.sim(Array(45).fill(1/30),0,0));
const r=await p.evaluate(()=>{const V=window.__vale,{scene,renderer}=V.debug;const orig=renderer.renderBufferDirect.bind(renderer);const out={},cn={};let n=0;
 renderer.renderBufferDirect=function(cam,sc,geo,mat,obj,grp){const path=[];for(let q=obj;q&&q!==scene;q=q.parent)path.unshift(q.name||'?');const col=mat.color?mat.color.getHexString():'';const k=(cam.isOrthographicCamera?'SH ':'')+path.join('/')+':'+(mat.name||mat.type)+'#'+col+(obj.isInstancedMesh?' I'+obj.count:'')+' v'+(geo.attributes.position?geo.attributes.position.count:0);const ic=obj.isInstancedMesh?obj.count:1;const tc=(geo.index?geo.index.count:geo.attributes.position.count)/3*ic;out[k]=(out[k]||0)+tc;cn[k]=(cn[k]||0)+1;n++;return orig(cam,sc,geo,mat,obj,grp);};
 V.bench(1);renderer.renderBufferDirect=orig;return {n,out:Object.entries(out).sort((a,b)=>b[1]-a[1]),cn};});
console.log(JSON.stringify(r,null,0));await b.close();})().catch(e=>{console.error(e);process.exit(1)});
