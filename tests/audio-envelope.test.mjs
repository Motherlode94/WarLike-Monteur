import test from 'node:test';
import assert from 'node:assert/strict';
import {audioEnvelope,audioTrackGain} from '../audio-envelope.js';
import {readFileSync} from 'node:fs';

test('independent track fades smoothly without touching the audio source',()=>{
 const track={offset:3,volume:80,fadeIn:2,fadeOut:2,muted:false};
 assert.equal(audioTrackGain(track,2.99,10,100),0);
 assert.equal(audioTrackGain(track,3,10,100),0);
 assert.ok(Math.abs(audioTrackGain(track,4,10,100)-.4)<1e-9);
 assert.ok(Math.abs(audioTrackGain(track,8,10,100)-.8)<1e-9);
 assert.ok(Math.abs(audioTrackGain(track,12,10,100)-.4)<1e-9);
 assert.equal(audioTrackGain(track,13,10,100),0);
});
test('legacy audio tracks keep their unchanged volume and master gain',()=>{
 assert.equal(audioTrackGain({offset:0,volume:70},2,10,80),.56);
 assert.equal(audioTrackGain({offset:0,volume:70,muted:true},2,10,80),0);
 assert.equal(audioTrackGain({offset:0,volume:70},10,10,80),0);
});
test('invalid fades are bounded and cannot produce NaN or negative output',()=>{
 for(const fade of [null,undefined,-5,Infinity,NaN,1000]){
  const track={offset:0,volume:100,fadeIn:fade,fadeOut:fade};
  for(const t of [0,.5,1,2.5,4.999]){
   const value=audioEnvelope(track,t,5);
   assert.ok(Number.isFinite(value)&&value>=0&&value<=1);
  }
 }
});
test('primary and extra track fades are applied to monitoring and WebM render paths',()=>{
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(source,/function updateGain\(position=clock\)/);
 assert.match(source,/audioTrackGain\(audioTrack,position,audioAsset\(\)\.duration/);
 assert.match(source,/audioTrackGain\(track,position,asset\.duration/);
 assert.match(source,/else if\(!run\)music\.pause\(\);updateGain\(position\)/);
 assert.match(source,/audioSync\(clamp\(row\.start\+video\.currentTime-c\.start,0,duration\),true\)/);
});
