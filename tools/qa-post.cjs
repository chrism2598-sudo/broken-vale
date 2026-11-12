// M22c · post-chain QA: every quality level must compile all programs and present a lit frame (not a black canvas).
// The M22 vignette inlined the colour grade that three also prepends to every ShaderMaterial; on High the final
// pass failed to compile ("valeGrade: function already has a body") and phones on High saw a solid black world.
const puppeteer=require(process.env.PUPPETEER_CORE);const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:600000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let fail=0;
for(const q of ['high','lite']){const p=await b.newPage();await p.setViewport({width:412,height:860,isMobile:true,hasTouch:true});const errs=[];
p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{const t=m.text();if(m.type()==='error'||/Shader Error|program not valid/.test(t))errs.push(t.slice(0,200))});
await p.goto(`http://localhost:8090/?q=${q}&shot=spawn`,{waitUntil:'load'});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(2500);
const lum=await p.evaluate(()=>{const c=document.querySelector('canvas');const k=document.createElement('canvas');k.width=64;k.height=128;const x=k.getContext('2d');x.drawImage(c,0,0,64,128);const d=x.getImageData(0,0,64,128).data;let s=0;for(let i=0;i<d.length;i+=4)s+=(d[i]+d[i+1]+d[i+2])/3;return s/(d.length/4);});
const shaderErrs=errs.filter(e=>/Shader Error|program not valid|already has a body/.test(e));
const ok=lum>20&&shaderErrs.length===0;if(!ok)fail++;
console.log(q,JSON.stringify({ok,meanLum:+lum.toFixed(1),shaderErrors:shaderErrs.length,first:shaderErrs[0]||null,errors:errs.length}));
await p.screenshot({path:`shots/qa-post-${q}.png`});await p.close();}
await b.close();process.exit(fail?1:0);})().catch(e=>{console.log('ERR',e.message);process.exit(1)});
