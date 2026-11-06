# WarLike Monteur

Éditeur vidéo **autonome** dans le navigateur, indépendant de WarLike Engine.

## Version initiale utilisable

- Import de fichiers vidéo locaux (jusqu'à 40 médias ; 500 Mo maximum par média).
- Timeline de montage séquentielle avec plusieurs clips, réorganisation, suppression et coupe à la tête de lecture.
- Points d'entrée et de sortie ajustables, prévisualisation et navigation.
- Titres superposés (haut, centre, bas), couleur et volume par clip.
- Formats de sortie 16:9, 9:16 et 1:1 ; résolutions 480p, 720p et 1080p.
- Export WebM via `canvas.captureStream()`, Web Audio et `MediaRecorder`, à vitesse réelle et jusqu'à 30 minutes de montage.
- Projet JSON exportable et réimportable **après avoir réimporté les mêmes médias locaux**. Les fichiers vidéo ne sont pas inclus dans le JSON.

## Démarrage

Site statique : publier la racine via Cloudflare Pages ou lancer `python -m http.server 8080` dans le dépôt, puis ouvrir `http://localhost:8080`.

Toutes les vidéos sont traitées dans le navigateur. Aucun média n'est envoyé à un backend. L'application n'a pas de dépendances JavaScript externes.

## Limites importantes

Le moteur actuel est un **éditeur de clips séquentiels**, pas encore une DAW vidéo professionnelle : pas de pistes superposées, de transitions fondues, de mix audio multipiste indépendant, de proxies, de keyframes ou de rendu H.264/MP4 natif. La lecture MP4 dépend des codecs disponibles, mais l'export utilise WebM. Les performances dépendent fortement du navigateur, du matériel, de la mémoire et du format source. L'export se fait à vitesse réelle, doit rester au premier plan et peut échouer pour certains fichiers ou navigateurs. Les titres et l'audio sont enregistrés par capture temps réel ; aucune stabilité audiovisuelle professionnelle n'est garantie.

**Validation actuelle :** syntaxe JavaScript vérifiée et tous les identifiants de l'interface référencés sont présents. Tests de montage, lecture et export vidéo réels en navigateur restant à effectuer. Le déploiement Cloudflare nécessite un projet Pages connecté au dépôt.

## Suite

Prochaines étapes : montage multipiste (vidéo/voix/musique), transitions, images clés, formes d'onde, miniatures des clips, pistes audio séparées, correction couleur, sous-titres et moteur de rendu plus robuste.
