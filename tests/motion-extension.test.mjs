import test from 'node:test';
import assert from 'node:assert/strict';
import {validateMotionPack,installedMotionPresets,applyMotionPreset,MOTION_ID,MOTION_SCHEMA} from '../motion-extension.js';
import {motionAt,renderVideoFrame} from '../compositing.js';
const frame=(scale,x=0,opacity=100)=>({scale,x,y:0,rotation:0,opacity});
const preset={id:'zoom-in',name:'Zoom progressif',start:frame(100),end:frame(125,4)};
const pack={schema:MOTION_SCHEMA,presets:[preset]};
const storage=record=>({getItem:()=>JSON.stringify({[MOTION_ID]:record})});
test('motion packs require safe bounded keyframes and unique names',()=>{
 assert.deepEqual(validateMotionPack(pack).presets[0],preset);
 assert.throws(()=>validateMotionPack({...pack,presets:[preset,preset]}));
 assert.throws(()=>validateMotionPack({...pack,presets:[{...preset,end:frame(900)}]}));
 assert.throws(()=>validateMotionPack({...pack,presets:[{...preset,end:{...frame(100),x:'10'}}]}));
});
test('enabled installed pack is usable; disabled and corrupted packs are ignored',()=>{
 const record={enabled:true,schema:MOTION_SCHEMA,data:pack};assert.equal(installedMotionPresets(storage(record)).length,1);
 assert.deepEqual(installedMotionPresets(storage({...record,enabled:false})),[]);
 assert.deepEqual(installedMotionPresets(storage({...record,data:{schema:MOTION_SCHEMA,presets:[]}})),[]);
});
test('applied motion preserves color and reaches preview and exported frame interpolation',()=>{
 const effects=applyMotionPreset({grade:{brightness:120,contrast:100,saturation:100,warmth:0}},preset);
 assert.equal(effects.grade.brightness,120);assert.equal(motionAt(effects,.5).scale,112.5);assert.equal(motionAt(effects,1).x,4);
 const transforms=[];const ctx={save(){},restore(){},fillRect(){},translate(...args){transforms.push(['translate',...args])},rotate(){},scale(...args){transforms.push(['scale',...args])},drawImage(){},set fillStyle(v){},set globalAlpha(v){},set filter(v){}};
 renderVideoFrame(ctx,{readyState:2,videoWidth:100,videoHeight:100},{width:100,height:100},effects,1);
 assert.deepEqual(transforms.find(a=>a[0]==='scale'),['scale',1.25,1.25]);assert.deepEqual(transforms.find(a=>a[0]==='translate'),['translate',54,50]);
});
