import test from 'node:test';import assert from 'node:assert/strict';import {readNodeGrade} from '../node-bridge.js';
const basic={format:'warlike-node-effect',version:1,graph:{nodes:[{id:'a',type:'source',params:{}},{id:'b',type:'brightness',params:{amount:120}},{id:'c',type:'output',params:{}}],edges:[{from:'a',to:'b',input:'image'},{from:'b',to:'c',input:'image'}]}};
test('imports linear WarLike Node color grade',()=>assert.equal(readNodeGrade(basic).brightness,120));
test('rejects unsupported multi-layer compositing',()=>{const complex=structuredClone(basic);complex.graph.nodes[1].type='merge';assert.throws(()=>readNodeGrade(complex),/non pris en charge/);});
test('rejects animated source grades',()=>{const animated=structuredClone(basic);animated.graph.nodes[1].keyframes={amount:[{t:0,value:100}]};assert.throws(()=>readNodeGrade(animated),/keyframes/);});
