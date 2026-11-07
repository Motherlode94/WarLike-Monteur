import {readNodeGraph} from './node-bridge.js';
import {normalizeEffects,motionAt,cssFilter,renderVideoFrame,PRESETS,DEFAULT_KEYFRAME} from './compositing.js';
const $=id=>document.getElementById(id);
const video=$('preview'),stage=$('stage'),overlay=$('titleOverlay'),music=$('musicPlayer');
const assets=[],clips=[],audioAssets=[];let audioTrack=null;const undoStack=[],redoStack=[];let selection=-1,active=-1,playing=false,rendering=false,exporting=false;
let keyframeSide='start';let duration=0,clock=0,switching=false,outputUrl=null,audioContext=null,audioSource=null,audioOutput=null,musicSource=null,videoGain=null,musicGain=null;
const id=()=>crypto.randomUUID();
const fmt=s=>{s=Math.max(0,Math.floor(s||0));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');};
const status=s=>$('status').textContent=s;
const assetFor=clip=>assets.find(a=>a.id===clip?.assetId);
const length=clip=>Math.max(0,clip.end-clip.start);
const boundaries=()=>{let t=0;return clips.map((clip,index)=>{const start=t;t+=length(clip);return{clip,index,start,end:t};});};
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
function snapshot(){return{clips:structuredClone(clips),selection,audioTrack:audioTrack?{...audioTrack}:null,muteOriginal:$('muteOriginal').checked};}
function checkpoint(){if(exporting)return;undoStack.push(snapshot());if(undoStack.length>60)undoStack.shift();redoStack.length=0;historyButtons();}
function historyButtons(){$('undo').disabled=!undoStack.length||exporting;$('redo').disabled=!redoStack.length||exporting;}
function restoreSnapshot(state){playing=false;video.pause();music.pause();clips.splice(0,clips.length,...state.clips);selection=state.selection;audioTrack=state.audioTrack;$('muteOriginal').checked=state.muteOriginal;active=-1;seek(0);refresh();}
function historyMove(from,to){if(exporting||!from.length)return;to.push(snapshot());restoreSnapshot(from.pop());historyButtons();}
$('undo').onclick=()=>historyMove(undoStack,redoStack);$('redo').onclick=()=>historyMove(redoStack,undoStack);
function audioAsset(){return audioAssets.find(a=>a.id===audioTrack?.assetId)||null;}
function updateGain(){const base=Number($('volume').value)/100,clip=clips[active],source=$('muteOriginal').checked?0:(clip?.volume??100)/100*base,bed=(audioTrack?.volume??70)/100*base;if(videoGain){videoGain.gain.value=source;video.volume=1;}else video.volume=source;if(musicGain){musicGain.gain.value=bed;music.volume=1;}else music.volume=bed;}
function audioSync(position,run=false){const asset=audioAsset();if(!asset||position<audioTrack.offset||position>=audioTrack.offset+asset.duration||position>=duration){music.pause();return;}const intended=position-audioTrack.offset;if(music.dataset.asset!==asset.id){music.pause();music.src=asset.url;music.dataset.asset=asset.id;music.load();}if(music.readyState>=1&&Math.abs(music.currentTime-intended)>.25)try{music.currentTime=intended;}catch{}if(run&&music.paused)music.play().catch(()=>status('Piste audio indisponible.'));else if(!run)music.pause();updateGain();}

function metadata(url){return new Promise((resolve,reject)=>{const probe=document.createElement('video');probe.preload='metadata';probe.onloadedmetadata=()=>{const duration=probe.duration;probe.removeAttribute('src');probe.load();if(Number.isFinite(duration)&&duration>0)resolve(duration);else reject(Error('Durée vidéo non prise en charge'));};probe.onerror=()=>reject(Error('Format vidéo non reconnu'));probe.src=url;});}
function getFormat(){const [w,h]=$('aspect').value.split(':').map(Number);const max=Number($('resolution').value);return w>=h?{width:Math.round(max*w/h/2)*2,height:max}:{width:max,height:Math.round(max*h/w/2)*2};}
function paintTitle(clip){overlay.textContent=clip?.title||'';overlay.style.color=clip?.color||'#fff';overlay.className='title-overlay pos-'+(clip?.position||'bottom');}
function updateVideoEffects(){
 const clip=clips[active];if(!clip){video.style.filter='none';video.style.transform='none';video.style.opacity='1';return;}
 const progress=Math.max(0,Math.min(1,(video.currentTime-clip.start)/Math.max(.01,length(clip))));
 const motion=motionAt(clip.effects,progress),effects=normalizeEffects(clip.effects);
 video.style.filter=cssFilter(effects.grade);
 video.style.transform=`translate(${motion.x}%,${motion.y}%) rotate(${motion.rotation}deg) scale(${motion.scale/100})`;
 video.style.opacity=String(motion.opacity/100);
}
function showEffectValues(clip){
 const {grade,start,end}=normalizeEffects(clip?.effects);
 const frame=keyframeSide==='start'?start:end;
 for(const key of ['brightness','contrast','saturation','warmth']){$('fx'+key[0].toUpperCase()+key.slice(1)).value=grade[key];$('fx'+key[0].toUpperCase()+key.slice(1)+'Value').textContent=grade[key]+(key==='warmth'?'':' %');}
 for(const [field,key] of [['kfScale','scale'],['kfX','x'],['kfY','y'],['kfRotation','rotation'],['kfOpacity','opacity']])$(field).value=String(Math.round(frame[key]*100)/100);
 $('kfStart').setAttribute('aria-pressed',String(keyframeSide==='start'));$('kfEnd').setAttribute('aria-pressed',String(keyframeSide==='end'));
}

function updateLayout(){const [w,h]=$('aspect').value.split(':').map(Number);stage.style.aspectRatio=w+'/'+h;}
function renderAssets(){$('assetCount').textContent=assets.length+' fichier'+(assets.length>1?'s':'');const root=$('assets');root.replaceChildren();for(const a of assets){const card=document.createElement('div');card.className='asset';const name=document.createElement('strong');name.textContent=a.name;const detail=document.createElement('small');detail.textContent=fmt(a.duration)+' · '+(a.file.size/1048576).toFixed(1)+' Mo';const add=document.createElement('button');add.textContent='＋ Ajouter à la timeline';add.onclick=()=>{if(exporting)return;checkpoint();clips.push({id:id(),assetId:a.id,start:0,end:a.duration,title:'',position:'bottom',color:'#ffffff',volume:100,effects:normalizeEffects()});selection=clips.length-1;refresh(true);};card.append(name,detail,add);root.append(card);}if(!assets.length){const p=document.createElement('p');p.className='hint';p.textContent='Aucun média importé.';root.append(p);}}
function renderTimeline(){const root=$('clips');root.replaceChildren();duration=clips.reduce((t,c)=>t+length(c),0);$('timelineDuration').textContent=fmt(duration);if(!clips.length){const el=document.createElement('div');el.className='empty';el.textContent='Les clips ajoutés apparaîtront ici.';root.append(el);}for(const [i,c] of clips.entries()){const a=assetFor(c),button=document.createElement('button');button.type='button';button.className='clip'+(i===selection?' selected':'');button.style.width=clamp(100+length(c)*12,120,280)+'px';button.setAttribute('aria-pressed',String(i===selection));const n=document.createElement('strong');n.textContent=a?.name||'Fichier absent';const wave=document.createElement('span');wave.className='wave';const time=document.createElement('small');time.textContent=fmt(length(c))+(c.title?' · Titre':'');button.append(n,wave,time);button.onclick=()=>{if(exporting)return;selection=i;const bound=boundaries()[i];seek(bound.start);renderTimeline();renderInspector();};root.append(button);}}
function renderInspector(){const c=clips[selection],a=assetFor(c);$('clipFields').disabled=!c||exporting;$('clipInfo').textContent=c?a.name+' · '+fmt(length(c)):'Sélectionne un clip dans la timeline.';if(!c){showEffectValues(null);return;}showEffectValues(c);$('trimStart').value=c.start.toFixed(2);$('trimEnd').value=c.end.toFixed(2);$('clipTitle').value=c.title;$('titlePosition').value=c.position;$('titleColor').value=c.color;$('clipVolume').value=c.volume;}
function refresh(reseek=false){renderAssets();renderTimeline();renderInspector();renderAudio();updateLayout();historyButtons();if(reseek){seek(0);}else updateClock();}
function updateClock(){$('time').textContent=fmt(clock)+' / '+fmt(duration);$('scrub').disabled=!duration||exporting;$('scrub').value=duration?String(Math.round(clamp(clock/duration,0,1)*1000)):0;$('play').textContent=playing?'❚❚':'▶';$('noPreview').hidden=Boolean(clips.length);}
async function setClip(index,offset=0,autoplay=false){const clip=clips[index],asset=assetFor(clip);if(!asset)return;const intended=clamp(clip.start+offset,clip.start,clip.end);switching=true;const changed=active!==index||video.dataset.asset!==asset.id;
 active=index;paintTitle(clip);updateGain();updateVideoEffects();
 try{if(changed){video.pause();video.src=asset.url;video.dataset.asset=asset.id;await new Promise((resolve,reject)=>{if(video.readyState>=1)return resolve();const done=()=>{video.removeEventListener('loadedmetadata',done);video.removeEventListener('error',failed);resolve();},failed=()=>{video.removeEventListener('loadedmetadata',done);video.removeEventListener('error',failed);reject(Error('Vidéo illisible'));};video.addEventListener('loadedmetadata',done);video.addEventListener('error',failed);});}
 if(Math.abs(video.currentTime-intended)>.07){video.currentTime=intended;await new Promise(resolve=>{if(Math.abs(video.currentTime-intended)<.05&&video.readyState>=2)return resolve();video.addEventListener('seeked',resolve,{once:true});setTimeout(resolve,1200);});}
 }finally{switching=false;}
 if(autoplay)await video.play();
}
async function seek(position){if(exporting)return;clock=clamp(position,0,duration);const row=boundaries().find(b=>clock<b.end-.0001)||boundaries().at(-1);if(!row){video.pause();music.pause();video.style.filter='none';video.style.transform='none';video.style.opacity='1';video.removeAttribute('src');video.load();active=-1;paintTitle(null);updateClock();return;}playing=false;video.pause();audioSync(clock,false);try{await setClip(row.index,clock-row.start,false);}catch(e){status(e.message);}updateVideoEffects();updateClock();}
function nextFrom(index){const b=boundaries();return b[index+1]||null;}
async function stepPlayback(){if(!playing||switching||exporting)return;const row=boundaries()[active];if(!row)return;clock=clamp(row.start+video.currentTime-row.clip.start,0,duration);audioSync(clock,true);updateVideoEffects();if(video.currentTime>=row.clip.end-.055||video.ended){const next=nextFrom(active);if(next){try{await setClip(next.index,0,true);}catch(e){playing=false;status('Lecture interrompue : '+e.message);}}else{playing=false;video.pause();music.pause();clock=duration;}}updateClock();}
video.addEventListener('timeupdate',stepPlayback);video.addEventListener('ended',stepPlayback);
async function togglePlay(){if(exporting||!clips.length)return;if(playing){playing=false;video.pause();music.pause();updateClock();return;}if(clock>=duration-.01)await seek(0);const row=boundaries().find(b=>clock<b.end)||boundaries().at(-1);try{await setClip(row.index,clock-row.start,true);playing=true;audioSync(clock,true);status('Lecture du montage.');}catch(e){playing=false;status('Lecture impossible : '+e.message);}updateClock();}
$('play').onclick=togglePlay;
$('previous').onclick=()=>{if(!exporting&&clips.length)seek(boundaries()[Math.max(active,0)]?.start||0);};
$('next').onclick=()=>{if(!exporting&&clips.length){const next=boundaries()[Math.min(Math.max(active+1,0),clips.length-1)];seek(next.start);}};
$('scrub').oninput=e=>{if(duration)seek(Number(e.target.value)/1000*duration);};
$('volume').oninput=updateGain;
$('aspect').onchange=updateLayout;
$('files').onchange=async e=>{const files=[...(e.target.files||[])];e.target.value='';if(exporting)return;let imported=0;for(const file of files){if(assets.length>=40){status('Limite de 40 fichiers.');break;}if(file.size>500*1048576){status('Fichier refusé (> 500 Mo) : '+file.name);continue;}const url=URL.createObjectURL(file);try{const seconds=await metadata(url);assets.push({id:id(),name:file.name,file,url,duration:seconds});imported++;}catch(err){URL.revokeObjectURL(url);status(file.name+' : '+err.message);}}if(imported){status(imported+' fichier(s) importé(s).');refresh();}};
function editClip(property,value){const c=clips[selection],asset=assetFor(c);if(!c||!asset||exporting)return;checkpoint();const before={...c};if(property==='start'){c.start=clamp(Number(value),0,c.end-.1);}else if(property==='end'){c.end=clamp(Number(value),c.start+.1,asset.duration);}else c[property]=value;if(!Number.isFinite(c.start)||!Number.isFinite(c.end)||length(c)<.09){Object.assign(c,before);status('Bornes de découpage invalides.');}refresh();paintTitle(clips[active]);updateGain();}
for(const [field,prop] of [['trimStart','start'],['trimEnd','end'],['clipTitle','title'],['titlePosition','position'],['titleColor','color'],['clipVolume','volume']]){$(field).addEventListener('change',e=>editClip(prop,prop==='volume'?Number(e.target.value):e.target.value));}
function applyNodeGraph(envelope){
 const clip=clips[selection];if(!clip)throw Error('Sélectionne un clip avant d’appliquer l’effet Node.');
 if(exporting)throw Error('Attends la fin de l’export vidéo.');
 const imported=readNodeGraph(envelope);
 checkpoint();clip.nodeGraph=imported.envelope;
 if(imported.previewSupported){clip.effects=normalizeEffects(clip.effects);clip.effects.grade={...imported.grade};}
 showEffectValues(clip);updateVideoEffects();
 const detail=imported.previewSupported?'Correction couleur appliquée et graphe conservé.':'Graphe complexe conservé ; le rendu est non pris en charge et son export est bloqué.';
 status(detail);return detail;
}
$('nodeEffectImport').onchange=async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>500000)throw Error('Fichier trop volumineux.');applyNodeGraph(JSON.parse(await file.text()));}catch(err){status('Effet refusé : '+err.message);}};
let pendingNodeEffect=null;
$('applyReceivedNode').onclick=()=>{
 if(!pendingNodeEffect)return;
 try{applyNodeGraph(pendingNodeEffect);pendingNodeEffect=null;$('applyReceivedNode').disabled=true;}
 catch(e){status(e.message);}
};
const NODE_ORIGIN='https://warlike-node.pages.dev';
const transferChannel=new URLSearchParams(location.search).get('nodeTransfer');
if(transferChannel&&/^[a-f0-9]{40}$/.test(transferChannel)&&window.opener){
 const notify=message=>window.opener?.postMessage({...message,channel:transferChannel},NODE_ORIGIN);
 window.addEventListener('message',event=>{
  if(event.origin!==NODE_ORIGIN||event.source!==window.opener||event.data?.channel!==transferChannel)return;
  if(event.data.type==='warlike-node-ping-v1'){notify({type:'warlike-monteur-ready-v1'});return;}
  if(event.data.type!=='warlike-node-transfer-v1')return;
  try{
   const effect=event.data.effect;
   if(JSON.stringify(effect).length>500000)throw Error('Graphe trop volumineux.');
   pendingNodeEffect=readNodeGraph(effect).envelope;
   $('applyReceivedNode').disabled=false;
   status('Graphe reçu depuis Node : sélectionne un clip puis clique sur « Appliquer effet Node reçu ». Aucun média n’a été transféré.');
   notify({type:'warlike-monteur-imported-v1',ok:true,detail:'Sélectionne un clip et applique l’effet reçu.'});
  }catch(error){status('Transfert Node refusé : '+error.message);notify({type:'warlike-monteur-imported-v1',ok:false,error:error.message});}
 });
 notify({type:'warlike-monteur-ready-v1'});
}
const gradeKeys=['brightness','contrast','saturation','warmth'];
for(const key of gradeKeys){
 const name='fx'+key[0].toUpperCase()+key.slice(1);
 const node=$(name);let before=null;
 node.addEventListener('input',()=>{const clip=clips[selection];if(!clip||exporting)return;if(!before)before=snapshot();clip.effects=normalizeEffects(clip.effects);clip.effects.grade[key]=Number(node.value);$(name+'Value').textContent=node.value+(key==='warmth'?'':' %');updateVideoEffects();});
 node.addEventListener('change',()=>{const clip=clips[selection];if(!clip||exporting){before=null;return;}if(before){undoStack.push(before);if(undoStack.length>60)undoStack.shift();redoStack.length=0;before=null;historyButtons();}else checkpoint();clip.effects=normalizeEffects(clip.effects);clip.effects.grade[key]=Number(node.value);updateVideoEffects();});
}
$('fxPreset').onchange=e=>{const clip=clips[selection];if(!clip||exporting)return;checkpoint();clip.effects=normalizeEffects(clip.effects);clip.effects.grade={...PRESETS[e.target.value]};showEffectValues(clip);updateVideoEffects();};
$('kfStart').onclick=()=>{keyframeSide='start';showEffectValues(clips[selection]);};
$('kfEnd').onclick=()=>{keyframeSide='end';showEffectValues(clips[selection]);};
for(const [field,key] of [['kfScale','scale'],['kfX','x'],['kfY','y'],['kfRotation','rotation'],['kfOpacity','opacity']]){
 $(field).addEventListener('change',e=>{const clip=clips[selection];if(!clip||exporting)return;const value=Number(e.target.value);if(!Number.isFinite(value))return showEffectValues(clip);checkpoint();clip.effects=normalizeEffects(clip.effects);clip.effects[keyframeSide][key]=value;clip.effects=normalizeEffects(clip.effects);showEffectValues(clip);updateVideoEffects();});
}
$('resetEffects').onclick=()=>{const clip=clips[selection];if(!clip||exporting)return;checkpoint();clip.effects=normalizeEffects();$('fxPreset').value='none';showEffectValues(clip);updateVideoEffects();};
function moveClip(delta){if(selection<0||exporting)return;const j=selection+delta;if(j<0||j>=clips.length)return;checkpoint();[clips[j],clips[selection]]=[clips[selection],clips[j]];selection=j;seek(0);refresh();}
$('moveLeft').onclick=()=>moveClip(-1);$('moveRight').onclick=()=>moveClip(1);
$('removeClip').onclick=()=>{if(selection<0||exporting)return;checkpoint();clips.splice(selection,1);selection=clips.length?clamp(selection,0,clips.length-1):-1;seek(0);refresh();};
$('clear').onclick=()=>{if(exporting||!clips.length||!confirm('Vider la timeline ? Les fichiers restent disponibles dans Médias.'))return;checkpoint();clips.splice(0);selection=-1;seek(0);refresh();};
$('split').onclick=()=>{if(exporting||active<0)return;const row=boundaries()[active],c=row?.clip;if(!c)return;const at=c.start+clock-row.start;if(at<=c.start+.1||at>=c.end-.1)return status('Place la tête de lecture à l’intérieur du clip pour le couper.');checkpoint();const original=normalizeEffects(c.effects),cutProgress=(at-c.start)/Math.max(.01,c.end-c.start);
 const mid=motionAt(original,cutProgress);
 const copy={...c,id:id(),start:at,effects:{grade:{...original.grade},start:{...mid},end:{...original.end}}};
 c.effects={grade:{...original.grade},start:{...original.start},end:{...mid}};
 c.end=at;clips.splice(active+1,0,copy);selection=active+1;seek(clock);refresh();status('Clip coupé à '+fmt(clock)+'.');};

async function audioMetadata(url){return new Promise((resolve,reject)=>{const sample=new Audio();sample.preload='metadata';sample.onloadedmetadata=()=>{const seconds=sample.duration;sample.removeAttribute('src');sample.load();Number.isFinite(seconds)&&seconds>0?resolve(seconds):reject(Error('Durée audio invalide.'));};sample.onerror=()=>reject(Error('Audio non pris en charge.'));sample.src=url;});}
function renderAudio(){
 const root=$('audioClips');root.replaceChildren();const current=audioAsset();
 for(const a of audioAssets){const b=document.createElement('button');b.type='button';b.className='audio-item'+(current?.id===a.id?' selected':'');b.textContent=(current?.id===a.id?'♫ En piste · ':'＋ Ajouter · ')+a.name+' ('+fmt(a.duration)+')';b.onclick=()=>{if(exporting)return;checkpoint();audioTrack={assetId:a.id,offset:0,volume:audioTrack?.volume??70};audioSync(clock,playing);renderAudio();};root.append(b);}
 if(!audioAssets.length){const p=document.createElement('p');p.className='hint';p.textContent='Importe un audio (musique ou voix), puis ajoute-le à la piste.';root.append(p);}
 $('audioDuration').textContent=current?fmt(current.duration)+' · début '+fmt(audioTrack.offset):'Aucun audio';
 $('audioOffset').disabled=!current||exporting;$('audioVolume').disabled=!current||exporting;$('removeAudio').disabled=!current||exporting;
 if(current){$('audioOffset').value=String(audioTrack.offset);$('audioVolume').value=String(audioTrack.volume);}
}
$('audioFiles').onchange=async e=>{const files=[...(e.target.files||[])];e.target.value='';if(exporting)return;let added=0;for(const file of files){if(audioAssets.length>=20){status('Maximum 20 médias audio.');break;}if(file.size>200*1048576){status('Audio trop volumineux : '+file.name);continue;}const url=URL.createObjectURL(file);try{const seconds=await audioMetadata(url);audioAssets.push({id:id(),name:file.name,file,url,duration:seconds});added++;}catch(err){URL.revokeObjectURL(url);status(file.name+' : '+err.message);}}if(added){renderAudio();status(added+' fichier(s) audio importé(s).');}};
$('audioOffset').onchange=e=>{if(!audioTrack||exporting)return;const n=Number(e.target.value);if(!Number.isFinite(n)||n<0||n>duration){renderAudio();return status('Décalage audio invalide.');}checkpoint();audioTrack.offset=n;audioSync(clock,playing);renderAudio();};
$('audioVolume').oninput=e=>{if(!audioTrack||exporting)return;audioTrack.volume=Number(e.target.value);updateGain();};
$('removeAudio').onclick=()=>{if(!audioTrack||exporting)return;checkpoint();audioTrack=null;music.pause();renderAudio();};
$('muteOriginal').onchange=()=>{if(exporting)return;const previous=snapshot();previous.muteOriginal=!$('muteOriginal').checked;undoStack.push(previous);if(undoStack.length>60)undoStack.shift();redoStack.length=0;historyButtons();updateGain();};
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
$('saveProject').onclick=()=>{const project={format:'warlike-monteur-project',version:1,name:$('projectName').value,aspect:$('aspect').value,resolution:$('resolution').value,background:$('background').value,assets:assets.map(a=>({id:a.id,name:a.name,duration:a.duration,size:a.file.size})),audioAssets:audioAssets.map(a=>({id:a.id,name:a.name,duration:a.duration,size:a.file.size})),audioTrack:audioTrack?{...audioTrack}:null,muteOriginal:$('muteOriginal').checked,clips:clips.map(c=>({...c}))};download(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),'warlike-monteur-project.json');status('Projet sauvegardé (sans les fichiers vidéo).');};
$('projectImport').onchange=async e=>{const file=e.target.files?.[0];e.target.value='';if(!file||exporting)return;try{if(file.size>2e6)throw Error('Projet trop volumineux');const p=JSON.parse(await file.text());if(p.format!=='warlike-monteur-project'||p.version!==1||!Array.isArray(p.assets)||!Array.isArray(p.clips)||p.clips.length>400)throw Error('Format invalide');const lookup=new Map(p.assets.map(a=>[a.id,assets.find(x=>x.name===a.name&&x.file.size===a.size)]));const restored=[];for(const c of p.clips){const a=lookup.get(c.assetId);if(!a||!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.start<0||c.end>Math.min(a.duration+0.05,1e8)||c.end-c.start<.09)throw Error('Médias absents ou découpes invalides : réimporte les fichiers originaux avant le projet');restored.push({id:id(),assetId:a.id,start:c.start,end:Math.min(c.end,a.duration),title:String(c.title||'').slice(0,90),position:['top','center','bottom'].includes(c.position)?c.position:'bottom',color:/^#[0-9a-f]{6}$/i.test(c.color)?c.color:'#ffffff',volume:clamp(Number(c.volume)||0,0,100),effects:normalizeEffects(c.effects),nodeGraph:c.nodeGraph?readNodeGraph(c.nodeGraph).envelope:null});}let restoredAudio=null;
 if(p.audioTrack){const source=(Array.isArray(p.audioAssets)?p.audioAssets:[]).find(a=>a.id===p.audioTrack.assetId);const found=source&&audioAssets.find(a=>a.name===source.name&&a.file.size===source.size);if(!found)throw Error('Fichier audio manquant : réimporte-le avant le projet.');if(!Number.isFinite(p.audioTrack.offset)||p.audioTrack.offset<0||!Number.isFinite(p.audioTrack.volume))throw Error('Configuration audio invalide.');restoredAudio={assetId:found.id,offset:p.audioTrack.offset,volume:clamp(p.audioTrack.volume,0,100)};}
 checkpoint();clips.splice(0,clips.length,...restored);selection=clips.length?0:-1;audioTrack=restoredAudio;$('muteOriginal').checked=p.muteOriginal===true;music.pause();$('projectName').value=String(p.name||'Mon montage').slice(0,80);if(['16:9','9:16','1:1'].includes(p.aspect))$('aspect').value=p.aspect;if([480,720,1080].includes(Number(p.resolution)))$('resolution').value=p.resolution;if(/^#[0-9a-f]{6}$/i.test(p.background))$('background').value=p.background;seek(0);refresh();status('Projet rétabli avec les médias présents.');}catch(err){status('Import impossible : '+err.message);}};
async function getAudio(){
 if(audioContext)return;
 const Context=window.AudioContext||window.webkitAudioContext;if(!Context)throw Error('Web Audio indisponible');
 audioContext=new Context();audioOutput=audioContext.createMediaStreamDestination();
 audioSource=audioContext.createMediaElementSource(video);videoGain=audioContext.createGain();
 musicSource=audioContext.createMediaElementSource(music);musicGain=audioContext.createGain();
 audioSource.connect(videoGain);musicSource.connect(musicGain);
 videoGain.connect(audioOutput);musicGain.connect(audioOutput);
 videoGain.connect(audioContext.destination);musicGain.connect(audioContext.destination);
 updateGain();
}
function titleOnCanvas(ctx,c,width,height){if(!c.title)return;ctx.fillStyle=c.color;ctx.shadowColor='rgba(0,0,0,.9)';ctx.shadowBlur=14;ctx.textAlign='center';ctx.font='bold '+Math.round(height*.052)+'px system-ui';const words=c.title.split(/\s+/),rows=[];let row='';for(const word of words){const test=row?row+' '+word:word;if(ctx.measureText(test).width>width*.86&&row){rows.push(row);row=word;}else row=test;}if(row)rows.push(row);const lineHeight=height*.068;let y=c.position==='top'?height*.13:c.position==='center'?height/2-(rows.length-1)*lineHeight/2:height*.86-(rows.length-1)*lineHeight;for(const text of rows){ctx.fillText(text,width/2,y,width*.9);y+=lineHeight;}ctx.shadowBlur=0;}
function frame(ctx,canvas,c){const progress=Math.max(0,Math.min(1,(video.currentTime-c.start)/Math.max(.01,length(c))));renderVideoFrame(ctx,video,canvas,c.effects,progress,$('background').value);titleOnCanvas(ctx,c,canvas.width,canvas.height);}
async function validateRenderedWebM(blob){
 if(blob.size<1024)throw Error('Le WebM obtenu est anormalement petit.');
 const url=URL.createObjectURL(blob),probe=document.createElement('video');
 probe.preload='metadata';probe.muted=true;probe.playsInline=true;
 try{
  await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>{cleanup();reject(Error('Délai dépassé pendant la vérification du rendu.'));},12000);
   const done=()=>{cleanup();resolve();},fail=()=>{cleanup();reject(Error('Le WebM exporté ne peut pas être décodé par ce navigateur.'));};
   function cleanup(){clearTimeout(timeout);probe.removeEventListener('loadedmetadata',done);probe.removeEventListener('error',fail);}
   probe.addEventListener('loadedmetadata',done);probe.addEventListener('error',fail);probe.src=url;
  });
  if(!probe.videoWidth||!probe.videoHeight)throw Error('La piste vidéo du rendu est invalide.');
  return{width:probe.videoWidth,height:probe.videoHeight};
 }finally{probe.pause();probe.removeAttribute('src');probe.load();URL.revokeObjectURL(url);}
}
function waitEnd(c,ctx,canvas){return new Promise((resolve,reject)=>{let done=false;const timeout=setTimeout(()=>finish(Error('Temps de lecture dépassé.')),Math.ceil(length(c)*1000+12000));function finish(error){if(done)return;done=true;clearTimeout(timeout);video.removeEventListener('error',onError);error?reject(error):resolve();}const onError=()=>finish(Error('Décodage vidéo interrompu'));video.addEventListener('error',onError);const tick=()=>{if(done)return;try{const row=boundaries()[active];if(row)audioSync(clamp(row.start+video.currentTime-c.start,0,duration),true);frame(ctx,canvas,c);if(video.currentTime>=c.end-.025||video.ended){finish();return;}if(video.paused&&!video.seeking){finish(Error('Lecture interrompue pendant l’export'));return;}requestAnimationFrame(tick);}catch(e){finish(e);}};requestAnimationFrame(tick);});}
$('exportVideo').onclick=async()=>{if(exporting||!clips.length)return;const supports=typeof MediaRecorder!=='undefined'&&HTMLCanvasElement.prototype.captureStream;if(!supports)return status('Ce navigateur ne peut pas enregistrer une vidéo WebM.');const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));if(!mime)return status('Aucun encodeur WebM compatible.');if(duration>1800)return status('Export limité à 30 minutes pour cette version.');if(clips.some(c=>c.nodeGraph&&!readNodeGraph(c.nodeGraph).previewSupported))return status('Export bloqué : un graphe Node complexe est conservé dans le projet mais son rendu n’est pas pris en charge. Retire-le ou utilise uniquement des corrections couleur compatibles.');exporting=true;playing=false;video.pause();music.pause();$('exportVideo').disabled=true;$('mode').textContent='EXPORT EN COURS';renderInspector();updateClock();let recorder=null,stream=null;
 try{await getAudio();await audioContext.resume();if(audioTrack){const a=audioAsset();if(a){music.src=a.url;music.dataset.asset=a.id;music.load();await new Promise((resolve,reject)=>{if(music.readyState>=1)return resolve();const ok=()=>{music.removeEventListener('loadedmetadata',ok);music.removeEventListener('error',fail);resolve();},fail=()=>{music.removeEventListener('loadedmetadata',ok);music.removeEventListener('error',fail);reject(Error('Musique illisible'));};music.addEventListener('loadedmetadata',ok);music.addEventListener('error',fail);});}}const size=getFormat(),canvas=document.createElement('canvas');canvas.width=size.width;canvas.height=size.height;const ctx=canvas.getContext('2d',{alpha:false});stream=canvas.captureStream(30);for(const t of audioOutput.stream.getAudioTracks())stream.addTrack(t);const data=[];recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:Math.min(8000000,size.width*size.height*5)});const finished=new Promise((resolve,reject)=>{recorder.ondataavailable=e=>{if(e.data.size)data.push(e.data);};recorder.onerror=e=>reject(Error(e.error?.message||'Erreur d’encodage'));recorder.onstop=()=>resolve(new Blob(data,{type:mime}));});
 recorder.start(1000);
 for(let i=0;i<clips.length;i++){const c=clips[i];status('Export '+(i+1)+' / '+clips.length+' : '+(assetFor(c)?.name||'clip'));await setClip(i,0,false);audioSync(boundaries()[i].start,false);frame(ctx,canvas,c);await video.play();audioSync(boundaries()[i].start,true);await waitEnd(c,ctx,canvas);video.pause();music.pause();}
 recorder.stop();const blob=await finished;if(!blob.size)throw Error('Le fichier exporté est vide.');status('Contrôle du fichier exporté…');await validateRenderedWebM(blob);download(blob,($('projectName').value.trim()||'warlike-montage').replace(/[^a-z0-9-_]+/gi,'-')+'.webm');status('Export WebM terminé : '+(blob.size/1048576).toFixed(1)+' Mo.');
 }catch(err){status('Export interrompu : '+err.message);if(recorder&&recorder.state!=='inactive')recorder.stop();}
 finally{video.pause();music.pause();if(stream)for(const track of stream.getTracks())if(track.kind==='video')track.stop();exporting=false;$('exportVideo').disabled=false;$('mode').textContent='PRÉVISUALISATION';await seek(0);renderInspector();}
};
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat&&!e.target.closest('input,textarea,select,button,[contenteditable]')){e.preventDefault();togglePlay();}});
window.addEventListener('beforeunload',()=>{assets.forEach(a=>URL.revokeObjectURL(a.url));audioAssets.forEach(a=>URL.revokeObjectURL(a.url));});
renderAssets();renderTimeline();renderInspector();renderAudio();historyButtons();updateLayout();updateClock();
