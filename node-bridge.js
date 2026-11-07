// Import a safe, limited subset of WarLike Node visual effects as Monteur color corrections.
export function readNodeGrade(envelope){
 if(envelope?.format!=='warlike-node-effect'||envelope.version!==1||!envelope.graph||!Array.isArray(envelope.graph.nodes)||!Array.isArray(envelope.graph.edges))throw Error('Fichier WarLike Node non reconnu.');
 const {nodes,edges}=envelope.graph;
 if(nodes.length>60||edges.length>120)throw Error('Graphe trop volumineux.');
 const ids=new Map(nodes.map(n=>[n.id,n]));
 if(ids.size!==nodes.length)throw Error('Identifiants répétés.');
 const output=nodes.find(n=>n.type==='output');if(!output)throw Error('Sortie manquante.');
 const visited=new Set(),chain=[];let current=output;
 while(current){
  if(visited.has(current.id))throw Error('Cycle détecté.');visited.add(current.id);
  if(current.keyframes&&Object.values(current.keyframes).some(keys=>Array.isArray(keys)&&keys.length))throw Error('Les keyframes des effets ne sont pas encore importables dans Monteur.');
  if(['source','video'].includes(current.type))break;
  if(!['output','brightness','contrast','saturation','grayscale'].includes(current.type))throw Error('Nœud '+current.type+' non pris en charge par l’adaptateur couleur Monteur.');
  chain.unshift(current);
  const links=edges.filter(e=>e.to===current.id);
  if(links.length!==1)throw Error('Graphe non linéaire : utilise un seul chemin couleur pour Monteur.');
  current=ids.get(links[0].from);if(!current)throw Error('Référence manquante.');
 }
 if(!current||!['source','video'].includes(current.type))throw Error('Source invalide.');
 const grade={brightness:100,contrast:100,saturation:100,warmth:0};
 for(const node of chain){
  const amount=Number(node.params?.amount);
  if(node.type==='grayscale')grade.saturation=0;
  else if(['brightness','contrast','saturation'].includes(node.type)){
   if(!Number.isFinite(amount)||amount<0||amount>300)throw Error('Paramètre couleur invalide.');
   grade[node.type]=Math.min(node.type==='saturation'?250:200,Math.max(node.type==='saturation'?0:30,grade[node.type]*amount/100));
  }
 }
 return grade;
}

/**
 * Read and preserve a complete Node graph for project round-tripping.
 * A stored graph is NOT automatically renderable by Monteur; consumers must
 * explicitly check previewSupported before claiming visual parity.
 */
export function readNodeGraph(envelope){
 if(envelope?.format!=='warlike-node-effect'||envelope.version!==1)throw Error('Format effet Node incompatible.');
 const graph=envelope.graph;
 if(!graph||graph.schema!=='warlike-node-v2'||!Array.isArray(graph.nodes)||!Array.isArray(graph.edges)||graph.nodes.length>60||graph.edges.length>120)throw Error('Graphe Node invalide.');
 const ids=new Set();
 for(const n of graph.nodes){
  if(!n||typeof n.id!=='string'||!n.id||n.id.length>80||typeof n.type!=='string'||n.type.length>40||ids.has(n.id))throw Error('Identifiant de nœud invalide.');
  ids.add(n.id);
  if(!n.params||typeof n.params!=='object'||Array.isArray(n.params)||!n.keyframes||typeof n.keyframes!=='object'||Array.isArray(n.keyframes))throw Error('Paramètres de nœud invalides.');
  for(const seq of Object.values(n.keyframes)){
   if(!Array.isArray(seq)||seq.length>100||seq.some(k=>!k||!Number.isFinite(k.t)||!Number.isFinite(k.value)||k.t<0||k.t>3600||!['linear','smooth','hold'].includes(k.easing)))throw Error('Animation Node invalide.');
  }
 }
 const inputs=new Set();
 for(const e of graph.edges){
  if(!e||!ids.has(e.from)||!ids.has(e.to)||e.from===e.to||typeof e.input!=='string')throw Error('Connexion Node invalide.');
  const key=e.to+':'+e.input;
  if(inputs.has(key))throw Error('Port déjà utilisé.');
  inputs.add(key);
 }
 const byId=new Map(graph.nodes.map(n=>[n.id,n])),visiting=new Set(),visited=new Set();
 function walk(id){if(visiting.has(id))throw Error('Cycle Node interdit.');if(visited.has(id))return;visiting.add(id);for(const edge of graph.edges)if(edge.to===id)walk(edge.from);visiting.delete(id);visited.add(id);}
 for(const id of ids)walk(id);
 let grade=null;
 try{grade=readNodeGrade(envelope);}catch{}
 return {envelope:structuredClone(envelope),grade,previewSupported:grade!==null,requiresLocalMedia:graph.nodes.some(n=>['source','video'].includes(n.type))};
}
