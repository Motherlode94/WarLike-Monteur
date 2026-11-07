// Shared, deterministic Canvas2D renderer for a single WarLike Node graph.
// Source/video nodes reference the current Monteur clip. Distinct external media
// are deliberately rejected until an asset resolver is available.
const TYPES=new Set(['source','video','brightness','contrast','saturation','grayscale','blur','tint','merge','mask','chroma','gpu','output']);
const BLENDS={'source-over':'source-over',multiply:'multiply',screen:'screen',overlay:'overlay',lighter:'lighter'};
const clamp=(v,a,b,d=a)=>Number.isFinite(Number(v))?Math.min(b,Math.max(a,Number(v))):d;
const make=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const context=c=>c.getContext('2d',{willReadFrequently:true});
function sample(node,key,time){
 const value=node.params?.[key];
 const keys=node.keyframes?.[key];
 if(!Array.isArray(keys)||!keys.length)return value;
 if(time<=keys[0].t)return keys[0].value;
 for(let i=1;i<keys.length;i++){
  const a=keys[i-1],b=keys[i];
  if(time<=b.t){let x=clamp((time-a.t)/(b.t-a.t||1),0,1);
   if(a.easing==='hold')x=0;else if(a.easing==='smooth')x=x*x*(3-2*x);
   return a.value+(b.value-a.value)*x;
  }
 }
 return keys[keys.length-1].value;
}
export function graphSupport(envelope){
 const g=envelope?.graph;
 if(envelope?.format!=='warlike-node-effect'||envelope.version!==1||g?.schema!=='warlike-node-v2'||!Array.isArray(g.nodes)||!Array.isArray(g.edges))return {supported:false,reason:'Format de graphe invalide'};
 if(g.nodes.length>60||g.edges.length>120)return {supported:false,reason:'Graphe trop volumineux'};
 const unknown=g.nodes.find(n=>!TYPES.has(n.type));
 if(unknown)return {supported:false,reason:'Nœud non pris en charge : '+unknown.type};
 const sources=g.nodes.filter(n=>n.type==='source'||n.type==='video');
 if(sources.length!==1)return {supported:false,reason:'Un graphe Monteur doit avoir une seule source média'};
 const outputs=g.nodes.filter(n=>n.type==='output');
 if(outputs.length!==1)return {supported:false,reason:'Une sortie unique est nécessaire'};
 return {supported:true,reason:null};
}
export function renderNodeFrame(envelope,video,target,time=0){
 const support=graphSupport(envelope);if(!support.supported)throw Error(support.reason);
 const {nodes,edges}=envelope.graph,w=target.width,h=target.height;
 const nodeBy=new Map(nodes.map(n=>[n.id,n])),cache=new Map(),visiting=new Set();
 function incoming(id,port){const edge=edges.find(e=>e.to===id&&e.input===port);return edge?edge.from:null;}
 function render(id){
  if(cache.has(id))return cache.get(id);
  if(visiting.has(id))throw Error('Cycle dans le graphe');
  const node=nodeBy.get(id);if(!node)throw Error('Nœud manquant');
  visiting.add(id);const result=make(w,h),ctx=context(result);
  const input=port=>{const source=incoming(id,port);if(!source)throw Error('Entrée non connectée : '+port);return render(source);};
  const val=(key,d=0)=>Number.isFinite(Number(sample(node,key,time)))?Number(sample(node,key,time)):d;
  if(node.type==='source'||node.type==='video'){
   if(video.readyState<2||!video.videoWidth)throw Error('La source vidéo n’est pas décodée');
   const fit=Math.min(w/video.videoWidth,h/video.videoHeight),dw=video.videoWidth*fit,dh=video.videoHeight*fit;
   ctx.drawImage(video,(w-dw)/2,(h-dh)/2,dw,dh);
  }else if(node.type==='output'){
   ctx.drawImage(input('image'),0,0);
  }else if(['brightness','contrast','saturation','grayscale','blur'].includes(node.type)){
   const filter={brightness:()=>`brightness(${clamp(val('amount',100),0,300)}%)`,contrast:()=>`contrast(${clamp(val('amount',100),0,300)}%)`,saturation:()=>`saturate(${clamp(val('amount',100),0,300)}%)`,grayscale:()=> 'grayscale(100%)',blur:()=>`blur(${clamp(val('radius',0),0,100)}px)`};
   ctx.filter=filter[node.type]();ctx.drawImage(input('image'),0,0);ctx.filter='none';
  }else if(node.type==='merge'){
   ctx.drawImage(input('background'),0,0);
   ctx.save();ctx.globalAlpha=clamp(val('opacity',100)/100,0,1);
   ctx.globalCompositeOperation=BLENDS[node.params?.mode]||'source-over';
   ctx.drawImage(input('foreground'),0,0);ctx.restore();
  }else if(node.type==='mask'){
   ctx.drawImage(input('image'),0,0);
   const mask=make(w,h),m=context(mask),x=clamp(val('x',50),0,100)*w/100,y=clamp(val('y',50),0,100)*h/100;
   const rx=Math.max(1,clamp(val('rx',30),0,100)*w/100),ry=Math.max(1,clamp(val('ry',30),0,100)*h/100),feather=clamp(val('feather',0),0,100)/100;
   // Build a soft elliptical alpha matte using concentric ellipses.
   const steps=feather>0?20:1;
   for(let i=steps;i>=1;i--){
    const r=feather>0?1-feather+feather*i/steps:1;
    m.beginPath();m.ellipse(x,y,rx*r,ry*r,0,0,Math.PI*2);
    m.fillStyle=`rgba(255,255,255,${feather>0?1/steps:1})`;m.fill();
   }
   ctx.globalCompositeOperation=val('invert')>0.5?'destination-out':'destination-in';
   ctx.drawImage(mask,0,0);ctx.globalCompositeOperation='source-over';
  }else if(['chroma','tint','gpu'].includes(node.type)){
   ctx.drawImage(input('image'),0,0);
   const pixels=ctx.getImageData(0,0,w,h),d=pixels.data;
   const hex=/^#[0-9a-f]{6}$/i.test(node.params?.color)?node.params.color:'#00ff00';
   const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
   const strength=clamp(val('strength',30)/100,0,1),threshold=clamp(val('threshold',75),0,500),softness=Math.max(1,clamp(val('softness',25),0,500));
   for(let i=0;i<d.length;i+=4){
    if(node.type==='gpu'){d[i]*=clamp(val('red',100),0,300)/100;d[i+1]*=clamp(val('green',100),0,300)/100;d[i+2]*=clamp(val('blue',100),0,300)/100;}
    else if(node.type==='tint'){for(let j=0;j<3;j++)d[i+j]=d[i+j]*(1-strength)+rgb[j]*strength;}
    else {const dist=Math.hypot(d[i]-rgb[0],d[i+1]-rgb[1],d[i+2]-rgb[2]);d[i+3]*=clamp((dist-threshold)/softness,0,1);}
   }
   ctx.putImageData(pixels,0,0);
  }
  visiting.delete(id);cache.set(id,result);return result;
 }
 const output=nodes.find(n=>n.type==='output');
 const result=render(output.id);
 const dest=context(target);dest.clearRect(0,0,w,h);dest.drawImage(result,0,0);
 return target;
}
