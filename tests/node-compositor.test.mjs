import test from 'node:test';
import assert from 'node:assert/strict';
import {graphSupport} from '../node-compositor.js';
const node=(id,type,params={})=>({id,type,params,keyframes:{}});
function effect(nodes,edges){return{format:'warlike-node-effect',version:1,graph:{schema:'warlike-node-v2',nodes,edges,fps:25,length:10}};}
test('Canvas compositor supports actual masked and merged video graph with one media source',()=>{
 const graph=effect([node('s','video'),node('a','blur',{radius:3}),node('b','mask',{x:50,y:50,rx:20,ry:20,feather:5,invert:0}),node('m','merge',{opacity:75,mode:'screen'}),node('o','output')],[{from:'s',to:'a',input:'image'},{from:'s',to:'b',input:'image'},{from:'a',to:'m',input:'background'},{from:'b',to:'m',input:'foreground'},{from:'m',to:'o',input:'image'}]);
 assert.deepEqual(graphSupport(graph),{supported:true,reason:null});
});
test('multiple independent media sources are not represented as supported',()=>{
 const graph=effect([node('a','video'),node('b','source'),node('o','output')],[{from:'a',to:'o',input:'image'}]);
 assert.equal(graphSupport(graph).supported,false);
});
test('unknown nodes do not silently render',()=>{
 const graph=effect([node('a','video'),node('b','future-ai-filter'),node('o','output')],[]);
 assert.equal(graphSupport(graph).supported,false);
});