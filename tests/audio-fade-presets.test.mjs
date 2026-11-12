import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AUDIO_FADE_ID,AUDIO_FADE_SCHEMA,validateAudioFadePack,installedAudioFadePresets,applyAudioFadePreset} from '../audio-fade-presets.js';

const catalog={schema:AUDIO_FADE_SCHEMA,presets:[
 {id:'narration',name:'Narration',fadeIn:.5,fadeOut:1},
 {id:'ambiance',name:'Ambiance',fadeIn:5,fadeOut:8}
]};
const storage=value=>({getItem:()=>JSON.stringify(value)});
test('validates installable fade presets, their numerical limits and unique names',()=>{
 const out=validateAudioFadePack(catalog);
 assert.equal(out.presets.length,2);
 assert.throws(()=>validateAudioFadePack({...catalog,presets:[catalog.presets[0],catalog.presets[0]]}),/invalide/);
 assert.throws(()=>validateAudioFadePack({...catalog,presets:[{...catalog.presets[0],fadeIn:Infinity}]}),/invalide/);
 assert.throws(()=>validateAudioFadePack({...catalog,presets:[{...catalog.presets[0],fadeOut:16}]}),/invalide/);
 assert.throws(()=>validateAudioFadePack({...catalog,presets:[]}),/invalide/);
});
test('extension is used only when enabled and its schema matches',()=>{
 const records={[AUDIO_FADE_ID]:{enabled:true,schema:AUDIO_FADE_SCHEMA,data:catalog}};
 assert.equal(installedAudioFadePresets(storage(records)).length,2);
 records[AUDIO_FADE_ID].enabled=false;
 assert.deepEqual(installedAudioFadePresets(storage(records)),[]);
 records[AUDIO_FADE_ID].enabled=true;records[AUDIO_FADE_ID].schema='wrong';
 assert.deepEqual(installedAudioFadePresets(storage(records)),[]);
 assert.deepEqual(installedAudioFadePresets({getItem:()=>'{'}),[]);
});
test('short source audio clamps long fades rather than changing clip length',()=>{
 const initial={id:'x',volume:75,offset:10,muted:false};
 const changed=applyAudioFadePreset(initial,catalog.presets[1],6);
 assert.deepEqual(initial,{id:'x',volume:75,offset:10,muted:false});
 assert.equal(changed.fadeIn,3);assert.equal(changed.fadeOut,3);
 assert.equal(changed.volume,75);assert.equal(changed.offset,10);
});
test('store extension is registered in the target installer and has a live consumer',()=>{
 const installer=readFileSync(new URL('../extensions.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(installer,/AUDIO_FADE_ID\]:AUDIO_FADE_SCHEMA/);
 assert.match(installer,/validateAudioFadePack\(payload\)/);
 assert.match(app,/installedAudioFadePresets\(localStorage\)/);
 assert.match(app,/audioSync\(clock,playing\);renderAudio\(\)/);
});
