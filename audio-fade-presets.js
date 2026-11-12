export const AUDIO_FADE_ID='monteur-audio-fades';
export const AUDIO_FADE_SCHEMA='warlike.monteur.audio-fades.v1';
const idPattern=/^[a-z0-9][a-z0-9-]{1,49}$/;
export function validateAudioFadePack(data){
 if(!data||data.schema!==AUDIO_FADE_SCHEMA||!Array.isArray(data.presets)
   ||!data.presets.length||data.presets.length>24)throw Error('Pack de fondus audio invalide.');
 const seen=new Set();
 const presets=data.presets.map(p=>{
  if(!p||typeof p.id!=='string'||!idPattern.test(p.id)||seen.has(p.id)
    ||typeof p.name!=='string'||!p.name.trim()||p.name.length>70
    ||!Number.isFinite(p.fadeIn)||!Number.isFinite(p.fadeOut)
    ||p.fadeIn<0||p.fadeIn>15||p.fadeOut<0||p.fadeOut>15)
   throw Error('Préréglage de fondu invalide.');
  seen.add(p.id);
  return {id:p.id,name:p.name.trim(),fadeIn:p.fadeIn,fadeOut:p.fadeOut};
 });
 return {schema:AUDIO_FADE_SCHEMA,presets};
}
export function installedAudioFadePresets(storage){
 try{
  const records=JSON.parse(storage?.getItem('warlike.extensions.v1')||'{}');
  const item=records[AUDIO_FADE_ID];
  if(!item?.enabled||item.schema!==AUDIO_FADE_SCHEMA)return [];
  return validateAudioFadePack(item.data).presets;
 }catch{return []}
}
export function applyAudioFadePreset(track,preset,duration){
 const checked=validateAudioFadePack({schema:AUDIO_FADE_SCHEMA,presets:[preset]}).presets[0];
 const half=Math.max(0,Number(duration)||0)/2;
 return {...track,fadeIn:Math.min(checked.fadeIn,half),fadeOut:Math.min(checked.fadeOut,half)};
}
