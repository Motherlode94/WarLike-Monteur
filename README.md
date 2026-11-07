
## Intégration multipiste et WarLike Node — chantier novembre 2026

- La timeline conserve la séquence vidéo principale et dispose désormais de **plusieurs pistes audio indépendantes** : démarrage décalé, volume, mute, suppression, lecture synchronisée et mixage Web Audio inclus dans l'export WebM. Les pistes sont sauvegardées dans le JSON du projet (les médias doivent toujours être réimportés).
- L'import d'effet depuis WarLike Node conserve les graphes complets et rend via Canvas2D les graphes à **source unique** comportant luminosité, contraste, saturation, noir et blanc, flou, teinte, fusion, masque elliptique, chroma key et ajustement RGB. Les images clés numériques sont interpolées à l'instant du clip.
- La prévisualisation utilise un canvas superposé. L'export WebM utilise le même compositeur. Les graphes inconnus ou avec plusieurs sources médias sont refusés avant export pour éviter de produire une vidéo incomplète.
- Les sources multiples, les caches de médias entre applications, le montage **vidéo** multicouche, le rendu GPU généralisé, la synchronisation image par image sur machines lentes et l'export hors temps réel restent à développer. Le rendu Canvas2D à 1080p peut être coûteux.

### Vérifications recommandées
1. Importer deux vidéos, puis trois pistes audio ; régler différents débuts/volumes et couper la deuxième piste.
2. Sauvegarder le projet JSON, réimporter tous les médias, rouvrir et vérifier les positions audio et le mute.
3. Dans Node, produire un graphe à une source vidéo avec masque et animation, l'envoyer à Monteur, sélectionner un clip, appliquer, prévisualiser, puis exporter.
4. Relire le WebM dans un lecteur indépendant et vérifier image, son et durée. Le résultat n'est **pas encore certifié** sans essais sur les navigateurs et machines cibles.

# WarLike Monteur

Éditeur vidéo **autonome** dans le navigateur, indépendant de WarLike Engine.

## Version initiale utilisable

- Import de fichiers vidéo locaux (jusqu'à 40 médias ; 500 Mo maximum par média).
- Timeline de montage séquentielle avec plusieurs clips, réorganisation, suppression et coupe à la tête de lecture.
- Points d'entrée et de sortie ajustables, prévisualisation et navigation.
- Titres superposés (haut, centre, bas), couleur et volume par clip.
- Une piste audio indépendante pour musique ou voix (fichiers MP3/WAV/OGG compatibles), réglage du décalage et du volume, possibilité de couper le son original des vidéos.
- Annuler / rétablir pour les opérations de montage de clips, sélection de piste audio et réglage de son décalage (60 états d’historique maximum).
- Formats de sortie 16:9, 9:16 et 1:1 ; résolutions 480p, 720p et 1080p.
- Export WebM via `canvas.captureStream()`, Web Audio et `MediaRecorder`, à vitesse réelle et jusqu'à 30 minutes de montage.
- Projet JSON exportable et réimportable **après avoir réimporté les mêmes médias locaux**. Les fichiers vidéo et audio ne sont pas inclus dans le JSON. Le projet mémorise la piste audio et son positionnement.

## Démarrage

Site statique : publier la racine via Cloudflare Pages ou lancer `python -m http.server 8080` dans le dépôt, puis ouvrir `http://localhost:8080`.

Toutes les vidéos sont traitées dans le navigateur. Aucun média n'est envoyé à un backend. L'application n'a pas de dépendances JavaScript externes.

## Limites importantes

Le moteur actuel est un **éditeur de clips séquentiels**, pas encore une DAW vidéo professionnelle : une seule piste audio d’accompagnement, pas encore de pistes vidéo superposées, de transitions fondues, de mix audio multipiste complet, de proxies, d'animations avancées multi-images clés ou de rendu H.264/MP4 natif. La lecture MP4 dépend des codecs disponibles, mais l'export utilise WebM. Les performances dépendent fortement du navigateur, du matériel, de la mémoire et du format source. L'export se fait à vitesse réelle, doit rester au premier plan et peut échouer pour certains fichiers ou navigateurs. Les titres et les deux sources audio (son des vidéos + piste d’accompagnement) sont mélangés via Web Audio puis enregistrés par capture temps réel ; aucune stabilité audiovisuelle professionnelle n'est garantie.

**Validation actuelle :** syntaxe JavaScript vérifiée et tous les identifiants de l'interface référencés sont présents. Tests de montage, lecture et export vidéo réels en navigateur restant à effectuer. Le déploiement Cloudflare nécessite un projet Pages connecté au dépôt.

## Suite

Prochaines étapes : véritable montage vidéo multipiste, transitions, courbes d'animation et davantage d'images clés, formes d'onde, miniatures des clips, sous-titres et moteur de rendu plus robuste.

## Mise à jour audio et contrôle du montage

Importe d'abord des vidéos, puis un fichier de musique ou de voix dans la section Médias. Ajoute la piste audio en cliquant sur son nom dans la timeline. Tu peux déplacer le début du morceau et ajuster son volume, ainsi que désactiver le son original des vidéos. L'export WebM mélange les deux sources via des `GainNode` avant l'encodage.

Pour annuler les découpes et déplacements de clips, utiliser les boutons Annuler/Rétablir. L'historique est en mémoire et ne persiste pas après fermeture. **L'export audio/vidéo doit être validé dans un navigateur réel**, y compris pour la synchronisation des coupes, les vidéos longues et les codecs.

### Scénarios QA à vérifier sur appareil

1. Importer deux vidéos et une piste audio, puis découper et réordonner les vidéos.
2. Régler le décalage de la musique, écouter la jonction des deux vidéos et vérifier le volume.
3. Couper le son original, annuler/rétablir, sauvegarder en JSON, réimporter les médias et restaurer le projet.
4. Exporter un WebM avec audio et titres, puis contrôler durée, synchronisation et lecture du fichier sur un autre lecteur.
5. Tester sur mobile à 375 px, sur Chrome et Edge, et sur un navigateur ne supportant pas `MediaRecorder` WebM.

## Validation de l'export audio + vidéo

La sortie WebM est générée par `MediaRecorder` en capturant la vidéo d'un canvas et le mix Web Audio des sons vidéo + musique indépendante. Avant de proposer le fichier au téléchargement, l'application essaie maintenant de le rouvrir dans un décodeur vidéo HTML5 et exige des dimensions vidéo valides. **Ce contrôle ne garantit pas qu'une piste audio soit présente ou audible.**

Test de régression ajouté dans `tests/export.spec.mjs` : génération de deux vrais clips VP9 de couleurs différentes et d'une musique WAV (FFmpeg), lancement de Chromium (Playwright), export d'un WebM, contrôle de la piste vidéo et de la piste audio avec `ffprobe`, puis vérification du niveau audio non silencieux avec `ffmpeg volumedetect`. Le workflow `.github/workflows/export-test.yml` est prévu pour l'exécuter à chaque push sur `main`.

Commandes locales (Node.js 22+, Python 3 et FFmpeg disponibles) :

```sh
npm install
npx playwright install chromium
npm run test:export
```

L'existence du test **ne vaut pas preuve qu'il a réussi** : examiner le statut du workflow dans GitHub Actions. Les résultats d'exécution du navigateur et le fichier exporté n'ont pas encore été récupérés et contrôlés dans cette session.

## Couleurs, compositing et animation — mise à jour

Inspiré des **workflows** de montage et compositing professionnels, sans reprendre leur code ou leurs interfaces propriétaires :

- **Étalonnage par clip** : luminosité, contraste, saturation et température simulée, avec presets neutre, cinéma chaud, nuit froide, noir et blanc, couleurs vives.
- **Animations de transformation** : deux images clés par clip (début et fin) pour l'échelle, la position X/Y, la rotation et l'opacité ; interpolation linéaire à la lecture et à l'export.
- **Rendu partagé** : `compositing.js` centralise la normalisation des réglages, les filtres et le dessin sur canvas ; la prévisualisation utilise les équivalents CSS.
- **Coupes animées** : en divisant un clip, chaque portion conserve une animation recalculée à son point de coupe.
- **Compatibilité projets** : les anciens clips sans `effects` reçoivent des valeurs neutres ; les nouveaux réglages sont sauvegardés en JSON et annulables.

**Ce n'est pas encore un équivalent de Premiere Pro ou After Effects** : pas de compositing vidéo multi-couches, de masques, de suivi de mouvement ou de moteur d'effets temps réel professionnel. La température est une approximation par filtres navigateur, pas un réglage colorimétrique étalonné.

Tests : `npm run test:unit` contrôle les valeurs par défaut, les limites et l'interpolation. GitHub Actions lance ces tests avant le test de rendu WebM. Les calculs du module ont été exécutés dans un environnement JavaScript isolé avec résultats conformes ; les tests du navigateur et du rendu final restent à confirmer sur un navigateur réel.

## WarLike Node — Import d'effets compatibles

Dans l'inspecteur du clip sélectionné, utiliser **Importer un effet WarLike Node** pour charger le fichier `warlike-node-effect.json` exporté par WarLike Node. L'adaptateur `node-bridge.js` valide un graphe linéaire de traitement d'image et convertit les opérations `brightness`, `contrast`, `saturation`, `grayscale` en valeurs de correction couleur Monteur. Les réglages sont appliqués au clip, enregistrés dans le projet et annulables. Les graphes multicouches, les masques, les shaders GPU, les vidéos intégrées et les keyframes des nœuds ne peuvent pas encore être reproduits par cet adaptateur et sont refusés. Les médias Node ne sont pas transférés.

`npm run test:unit` inclut des tests de compatibilité du format d'échange.
