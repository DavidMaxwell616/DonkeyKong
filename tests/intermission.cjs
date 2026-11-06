const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Scene = vm.runInNewContext(fs.readFileSync('js/IntermissionScene.js', 'utf8').replace('export default class IntermissionScene', 'class IntermissionScene')+'\nIntermissionScene;', { Phaser: { Scene: class {} } });
const frames = new Set();
for (const height of [25,50,75,100,25]) {
 const scene = new Scene(), images = [], calls = [];
 const drawable = (width=224,height=256) => ({width,height,setOrigin(){return this;},add(){},setScale(v){this.scale=v;},setPosition(){}});
 const panel=drawable();
 scene.add={container:()=>panel,rectangle:()=>drawable(),image:(x,y,key,frame)=>{
  images.push({key,frame});
  if(key==='how-high' && frame!=='tier') assert.equal(frame,'__BASE');
  return drawable(frame==='tier'?96:224,frame==='tier'?32:256);
 }};
 scene.textures={get:()=>({has:n=>frames.has(n),add:n=>frames.add(n)})};
 scene.cameras={main:{setBackgroundColor(){}}};
 scene.scale={width:800,height:500,on(){},off(){}}; scene.events={once(){}};
 scene.time={delayedCall:(delay,fn)=>{scene.advance=fn;return {remove(){}};}};
 scene.scene={stop:(...args)=>calls.push(['stop',...args]),start:(...args)=>calls.push(['start',...args]),wake(){}};
 const data=height>=75?{height,resumeGame:false,previousScene:`Level${height/25-1}Scene`,nextScene:`Level${height/25}Scene`}:{height};
 scene.create(data);
 assert.equal(panel.scale,500/256);
 assert.equal(images.filter(i=>i.frame==='tier').length,height/25-1);
 scene.advance();
 if(height>=75) assert.equal(calls[1][1],data.nextScene);
}
console.log('PASS: repeated 25/50/75/100 m intermissions use full background, correct tier counts and scene transitions');
