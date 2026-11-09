import {normalizeEffects,normalizeKeyframe} from './compositing.js';
export const MOTION_ID='monteur-motion-studio';
export const MOTION_SCHEMA='warlike.monteur.motion-pack.v1';
const ranges={scale:[20,400],x:[-100,100],y:[-100,100],rotation:[-360,360],opacity:[0,100]};
export function validateMotionPack(data){
 if(!data||data.schema!==MOTION_SCHEMA||!Array.isArray(data.presets)||!data.presets.length||data.presets.length>30)throw Error('Pack mouvement invalide.');
 const ids=new Set();
 const presets=data.presets.map(p=>{
  if(!p||typeof p.id!=='string'||!/^[a-z0-9-]{2,50}$/.test(p.id)||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>70)throw Error('Identifiant ou nom de mouvement invalide.');ids.add(p.id);
  const frame=value=>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Images clés absentes.');for(const [key,range] of Object.entries(ranges)){const n=value[key];if(typeof n!=='number'||!Number.isFinite(n)||n<range[0]||n>range[1])throw Error('Valeur de mouvement invalide : '+key)}return normalizeKeyframe(value)};
  return {id:p.id,name:p.name.trim(),start:frame(p.start),end:frame(p.end)};
 });
 return {schema:MOTION_SCHEMA,presets};
}
export function installedMotionPresets(storage){
 try{const records=JSON.parse(storage.getItem('warlike.extensions.v1')||'{}'),entry=records[MOTION_ID];if(!entry?.enabled||entry.schema!==MOTION_SCHEMA)return [];return validateMotionPack(entry.data).presets}catch{return []}
}
export function applyMotionPreset(effects,preset){
 const checked=validateMotionPack({schema:MOTION_SCHEMA,presets:[preset]}).presets[0],current=normalizeEffects(effects);
 return {...current,start:{...checked.start},end:{...checked.end}};
}
