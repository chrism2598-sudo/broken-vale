const puppeteer=require(process.env.PUPPETEER_CORE || 'puppeteer-core') /* npm i -D puppeteer-core, or set PUPPETEER_CORE */;
(async()=>{
 const b=await puppeteer.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage();await p.setViewport({width:640,height:400});
 await p.goto('http://localhost:8090/?q=lite&shot=ilka-close',{timeout:120000});
 await p.waitForFunction('window.__vale&&window.__vale.ready',{timeout:240000});
 const r=await p.evaluate(()=>{const d=window.__vale.debug;const T=d.ilka.children[0];window.__b=[];d.ilka.updateMatrixWorld(true);d.ilka.traverse(o=>{if(o.isSkinnedMesh&&window.__b.length<2){o.computeBoundingBox();window.__b.push([o.boundingBox.min.toArray(),o.boundingBox.max.toArray(),o.bindMode,o.skeleton.bones.length])}});const out={cam:d.camera.position.toArray(),ilka:d.ilka.position.toArray(),frames:window.__vale.frames,meshes:[]};
  d.ilka.traverse(o=>{if(o.isMesh){o.updateWorldMatrix(true,false);const e=o.matrixWorld.elements;out.meshes.push([o.name,o.type,o.visible,o.frustumCulled,e[12].toFixed(2),e[13].toFixed(2),e[14].toFixed(2),Math.hypot(e[0],e[1],e[2]).toFixed(4),(o.material.name),o.material.opacity,o.material.transparent,o.material.color&&o.material.color.getHexString()])}});
  let sc=[];d.ilka.traverse(o=>{if(o.isBone&&sc.length<3){o.updateWorldMatrix(true,false);sc.push([o.name,o.matrixWorld.elements.slice(12,15).map(v=>v.toFixed(2))])}});out.bones=sc;out.b=window.__b;out.rootScale=T.scale.toArray();out.kids=T.children.map(c=>[c.name,c.type,c.scale.toArray(),c.rotation.toArray().slice(0,3)]);return out;});
 console.log(JSON.stringify(r,null,0));
 await b.close();
})();
