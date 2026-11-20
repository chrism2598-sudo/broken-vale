const PORT=process.env.PORT||'8090';
// M53 · High + Lite shader validation over key scenes: shader compile errors, WebGL getError, console/page errors,
// a screenshot per scene × quality, and mean luminance of the presented frame (guards the old High black-screen regression).
// Usage: node tools/m53-shaders.cjs [scene...]   (SHOTDIR defaults to ./shots)
const pc=require(process.env.PUPPETEER_CORE);const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const v=(x,z,h,pitch,dist)=>`__vale.warp(${x},${z});__vale.view(${h.toFixed(3)},${(h-Math.PI).toFixed(3)},${pitch},${dist})`;
const H=(x0,z0,x1,z1)=>Math.atan2(x1-x0,z1-z0);
const S={spawn:['shot=spawn',''],hub:['shot=spawn&tod=0.4',v(0,6,Math.PI,0.1,7)],'night-hub':['shot=spawn&tod=0.98',v(0,6,Math.PI,0.1,7)],
 hall:['shot=m20-hall',''],'pale-nook':['shot=m20-nookin',''],'azure-nook':['shot=m20-aznook',''],cave:['shot=cave-interior',''],
 veilfall:['shot=spawn&tod=0.4',v(-82,-66,H(-82,-66,-105.4,-81.7),0.0,8)],dome:['shot=spawn&tod=0.4',v(45.8,58,H(45.8,58,45.8,85.7),0.0,8)],coast:['shot=coast','']};
const DIR=process.env.SHOTDIR||'shots';
(async()=>{const b=await pc.launch({executablePath:'/usr/bin/google-chrome',headless:'new',protocolTimeout:600000,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const names=process.argv.slice(2).length?process.argv.slice(2):Object.keys(S);let bad=0;const out=[];
 for(const q of ['high','lite'])for(const n of names){const [qs,js]=S[n];const p=await b.newPage();const errs=[],warns=[];
  p.on('pageerror',e=>errs.push('PE '+e.message.slice(0,240)));p.on('console',m=>{const t=m.text();if(m.type()==='error')errs.push(t.slice(0,240));else if(/Shader|WebGL|GL_|program/i.test(t))warns.push(t.slice(0,240));});
  await p.setViewport({width:412,height:915,deviceScaleFactor:1,isMobile:true,hasTouch:true});
  await p.evaluateOnNewDocument(()=>{localStorage.setItem('vale3d-hero',JSON.stringify({name:'Ilka',sex:'female'}));});
  let r={};
  try{await p.goto(`http://localhost:${PORT}/?q=${q}&${qs}`,{waitUntil:'load',timeout:120000});await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});await sleep(3000);
   if(js)await p.evaluate(js);await p.evaluate(()=>window.__vale.sim(Array(30).fill(1/30),0,0));await sleep(2000);
   r=await p.evaluate(()=>{const c=document.querySelector('canvas');const gl=c.getContext('webgl2')||c.getContext('webgl');const ge=[];for(let i=0;i<5;i++){const e=gl.getError();if(!e)break;ge.push(e);}
     const k=document.createElement('canvas');k.width=64;k.height=128;const x=k.getContext('2d');x.drawImage(c,0,0,64,128);const d=x.getImageData(0,0,64,128).data;let s=0;for(let i=0;i<d.length;i+=4)s+=(d[i]+d[i+1]+d[i+2])/3;
     return {lum:+(s/(d.length/4)).toFixed(1),glErrors:ge,lost:gl.isContextLost()};});
   await p.screenshot({path:`${DIR}/m53-shader-${q}-${n}.png`});
  }catch(e){errs.push('CRASH '+e.message.slice(0,200));}
  const shaderErrs=[...errs,...warns].filter(e=>/Shader Error|program not valid|already has a body|VALIDATE_STATUS|compile/i.test(e));
  const ok=!!r.lum&&r.lum>8&&shaderErrs.length===0&&errs.length===0&&(r.glErrors||[]).length===0&&!r.lost;if(!ok)bad++;
  const row={q,scene:n,ok,meanLum:r.lum??null,shaderErrors:shaderErrs.length,glErrors:r.glErrors??null,contextLost:r.lost??null,consoleErrors:errs.length,firstError:errs[0]||shaderErrs[0]||null,glWarnings:warns.length,firstWarning:warns[0]||null};
  out.push(row);console.log((ok?'PASS ':'FAIL ')+JSON.stringify(row));await p.close();}
 require('fs').writeFileSync(process.env.OUT||'/tmp/m53-shaders.json',JSON.stringify(out,null,1));
 console.log(bad?`M53-SHADERS FAIL ${bad}`:'M53-SHADERS PASS');await b.close();process.exit(bad?1:0);})().catch(e=>{console.log('ERR',e.message);process.exit(2)});
