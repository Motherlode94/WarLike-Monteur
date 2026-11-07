import test from 'node:test';
import assert from 'node:assert/strict';
import {readNodeGraph} from '../node-bridge.js';

const source={id:'src',type:'source',params:{},keyframes:{}};
const mask={id:'mask',type:'mask',params:{x:50,y:50,rx:25,ry:25,feather:5,invert:0},keyframes:{x:[{t:0,value:20,easing:'linear'},{t:2,value:80,easing:'smooth'}]}};
const output={id:'out',type:'output',params:{},keyframes:{}};
function env(nodes=[source,mask,output],edges=[{from:'src',to:'mask',input:'image'},{from:'mask',to:'out',input:'image'}]){return{format:'warlike-node-effect',version:1,graph:{schema:'warlike-node-v2',nodes,edges,fps:25,length:10},requiresLocalMedia:true};}
test('retains complex masks and keyframes losslessly without claiming they render',()=>{
 const payload=env(),read=readNodeGraph(payload);
 assert.deepEqual(read.envelope,payload);
 assert.equal(read.previewSupported,false);
 assert.equal(read.grade,null);
 read.envelope.graph.nodes[1].params.x=1;
 assert.equal(payload.graph.nodes[1].params.x,50);
});
test('simple color graph can preview',()=>{
 const e=env([source,{id:'grade',type:'brightness',params:{amount:110},keyframes:{}},output],[{from:'src',to:'grade',input:'image'},{from:'grade',to:'out',input:'image'}]);
 const parsed=readNodeGraph(e);assert.equal(parsed.previewSupported,true);assert.equal(parsed.grade.brightness,110);
});
test('reject cycles, duplicate nodes, invalid keyframes and broken dependencies',()=>{
 assert.throws(()=>readNodeGraph(env([source,source,output],[])),/Identifiant/);
 assert.throws(()=>readNodeGraph(env(undefined,[{from:'src',to:'missing',input:'image'}])),/Connexion/);
 assert.throws(()=>readNodeGraph(env(undefined,[{from:'mask',to:'out',input:'image'},{from:'out',to:'mask',input:'image'}])),/Cycle/);
 assert.throws(()=>readNodeGraph(env([source,{...mask,keyframes:{x:[{t:-1,value:4,easing:'linear'}]}},output])),/Animation/);
});
