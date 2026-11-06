import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeEffects,normalizeGrade,motionAt,cssFilter,PRESETS} from '../compositing.js';
test('legacy clips without effects remain unchanged',()=>{
 const fx=normalizeEffects();
 assert.deepEqual(fx.grade,{brightness:100,contrast:100,saturation:100,warmth:0});
 assert.deepEqual(motionAt(fx,0),motionAt(fx,1));
});
test('end keyframe is reached and midpoint is interpolated',()=>{
 const fx=normalizeEffects({start:{scale:100,x:0,opacity:100},end:{scale:180,x:40,opacity:20}});
 assert.equal(motionAt(fx,0).scale,100);
 assert.equal(motionAt(fx,.5).scale,140);
 assert.equal(motionAt(fx,.5).x,20);
 assert.equal(motionAt(fx,.5).opacity,60);
 assert.equal(motionAt(fx,1).opacity,20);
});
test('values are clamped and missing fields default to neutral',()=>{
 const fx=normalizeEffects({grade:{brightness:2000,saturation:-4},end:{scale:0,x:999,rotation:900}});
 assert.equal(fx.grade.brightness,200);
 assert.equal(fx.grade.saturation,0);
 assert.equal(fx.grade.contrast,100);
 assert.equal(fx.end.scale,20);
 assert.equal(fx.end.x,100);
 assert.equal(fx.end.rotation,360);
});
test('presets produce finite canvas-compatible filter strings',()=>{
 for(const grade of Object.values(PRESETS)){
  const normalized=normalizeGrade(grade),filter=cssFilter(normalized);
  assert.match(filter,/^brightness\(\d+%\) contrast\(\d+%\) saturate\(\d+%\) sepia\([\d.]+\) hue-rotate\(-?[\d.]+deg\)$/);
 }
});
