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
