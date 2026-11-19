# Lutèce Quiz — quiz live façon Kahoot

Trois pages autonomes (CSS et JS intégrés), qui s'ouvrent par double-clic :

| Page | Rôle | Écran |
|---|---|---|
| `index.html` | Admin : créer, éditer, dupliquer, exporter/importer les quiz | Ordi de l'animateur |
| `host.html` | Partie : lobby + QR code, questions, résultats, classement, podium | Grand écran |
| `play.html` | Joueur : pseudo, 4 boutons, résultat perso | Mobiles |

## Tester tout de suite (mode démo local)

Sans config Firebase, tout tourne dans **un seul navigateur** : l'écran de jeu et les joueurs test dans des onglets séparés.

Double-clique sur `index.html` (dans **Chrome** de préférence), crée un quiz, clique **Lancer**, puis **Ouvrir un joueur test** (autant de fois que tu veux de joueurs).

## Modifier le code

Le code lisible est dans `source/`. Les pages à la racine sont générées à partir de lui :

```bash
cd source
npm i esbuild     # une seule fois
node build.mjs    # régénère index.html, host.html, play.html à la racine
```

Les réglages (Firebase, avatars, fréquence du classement) sont dans `config.js` à la racine : aucun rebuild nécessaire pour les modifier.

## Passer en vrai (mobiles via QR code) — Firebase, ~10 min

1. [console.firebase.google.com](https://console.firebase.google.com) → **Créer un projet** (Analytics inutile).
2. **Build → Realtime Database → Créer une base**, région `europe-west1`, mode verrouillé.
3. Onglet **Règles**, colle ceci puis **Publier** :
   ```json
   { "rules": { "rooms": { "$code": { ".read": true, ".write": true } } } }
   ```
   (Ouvert à qui connaît le code de partie : OK pour une soirée privée. Supprime le nœud `rooms` après l'événement.)
4. **Paramètres du projet → Vos applications → Web (`</>`)** → copie le contenu de `firebaseConfig` dans `config.js` (à la racine), en vérifiant que `databaseURL` est bien présent.
5. Héberge le dossier (GitHub Pages, Netlify…). L'admin affiche alors **● En ligne**.

Le plan gratuit (Spark) accepte 100 connexions simultanées : large pour 30 joueurs.

## Comment c'est construit

- **Quiz et médias** : stockés dans le navigateur de la machine admin (IndexedDB). Seul le grand écran affiche les images, vidéos et sons, donc ils ne transitent jamais par le réseau.
  → Prépare tes quiz **sur la machine qui pilotera l'écran**, ou passe par **Exporter / Importer** (le `.json` embarque les médias).
- **Temps réel** (`js/net.js`) : une seule API, deux backends (Firebase ou démo locale). Structure :
  `rooms/{CODE}/state` (phase courante) · `players/{id}` (pseudo, score) · `answers/{question}/{id}`.
- **Le grand écran est l'arbitre** : il ouvre et ferme les questions, calcule les scores et pousse l'état. Les mobiles ne font que suivre.
- **Score** : bonne réponse = 500 à 1000 pts selon la rapidité (horodatage serveur Firebase, donc pas faussé par l'horloge des téléphones), ×2 ou ×0 selon la question.
- **Reconnexion** : un joueur qui recharge ou verrouille son tel retrouve sa place et son score.

## Déroulé d'une partie

- **Lobby** : les joueurs scannent le QR, choisissent un pseudo puis un avatar (modifiable jusqu'au lancement).
- **Question vidéo** : la vidéo est lue en entier sur le grand écran, puis les réponses s'affichent et le temps démarre. À la fin du temps, la vidéo réponse (si tu en as ajouté une) est lue en entier, puis les résultats s'affichent. Bouton **Voir les résultats** pour la passer, **Revoir la vidéo** ensuite.
- **Scores secrets** : les téléphones indiquent seulement bonne ou mauvaise réponse ; rang et points à la toute fin.
- **Points doubles** : pastille ×2 sur la question (grand écran et téléphone).
- **Classement provisoire** (top 10) une seule fois, à mi-parcours (après la 20e question sur 40).
- **Résultats** : podium révélé étape par étape (3e, 2e, puis le 1er avec explosion de confettis).

## Avatars et mascotte

- `avatars/avatar-01.png` … `avatar-30.png` : placeholders numérotés. Remplace-les par tes images en gardant les mêmes noms (carrées, 256×256 conseillé). Pour un autre nombre, change `avatarCount` dans `config.js`.
- `img/star-*.png` : la mascotte (point, happy, run, scheme).

## Aperçu (tester sans joueurs)

Bouton **Aperçu** (icône œil) sur la carte du quiz, dans la barre de l'éditeur, ou sur chaque question pour démarrer à partir de celle-ci.
L'écran de jeu s'ouvre dans un onglet à part, sans QR ni lobby, avec 8 faux joueurs qui répondent tout seuls (graphes, classement et podium remplis).
Rien n'est envoyé en ligne. Navigation : flèches ◀ ▶ (ou ← →), liste déroulante des questions, bouton **Podium**.
Après une modification dans l'éditeur, clique à nouveau sur Aperçu pour recharger.

## Enchaînement automatique

Interrupteur **Auto** dans la barre du bas (activé par défaut, mémorisé sur l'ordinateur).
Quand **tous les joueurs ont répondu**, la question se ferme, les résultats restent affichés 6 secondes (compte à rebours sur le bouton), puis le jeu passe seul à la suite : question suivante, classement à mi-parcours ou résultats.
Si quelqu'un n'a pas répondu (temps écoulé), on reste en manuel.
- **Classement provisoire** : chaque joueur a un bouton **« Je suis prêt ! »** sur son téléphone ; le grand écran affiche « 3 / 5 prêts » et qui on attend. Quand tout le monde est prêt, la partie reprend toute seule (Espace force la reprise si un joueur a quitté).
- **Podium** : révélé tout seul avec un minuteur (3e après 3 s, puis 2e et 1er toutes les 4,5 s). Espace accélère, Pause arrête, l'interrupteur Auto désactive.
**Pause** stoppe le compte à rebours ; Espace passe tout de suite.

## Télécommande (piloter depuis son téléphone)

Dans le lobby du grand écran, clique sur un pseudo → **Donner la télécommande**. Une icône de télécommande apparaît à côté de son nom.
Sur son téléphone, une barre **Suivant** s'affiche en bas : elle fait exactement comme Espace (lancer, passer la vidéo, terminer la question, question suivante, classement, podium) et indique l'action à venir.
Un seul joueur à la fois ; reclique sur son pseudo → **Reprendre la télécommande** pour la lui retirer. Le clavier de l'ordinateur continue de marcher.

## Pilotage le jour J

- `Espace` / `Entrée` / `→` : action suivante (lancer, passer la vidéo, terminer la question, classement, question suivante, révéler le podium…)
- `F` : plein écran
- Clic sur un pseudo dans le lobby : retirer le joueur (pseudo inapproprié…)
- La question se ferme seule quand le temps est écoulé **ou** quand tout le monde a répondu.

## Checklist événement

- [ ] Partie test complète la veille, sur place si possible, avec 3-4 téléphones
- [ ] Wifi du lieu vérifié ; dire aux joueurs de passer en 4G/5G si ça rame
- [ ] Ordi host branché sur secteur, veille désactivée, son vers la sono
- [ ] Vidéos et sons testés sur la machine host (formats .mp4 / .mp3 conseillés)

## Fichiers

```
index.html  host.html  play.html
css/style.css
js/config.js   ← lit les réglages de ../config.js
js/net.js      ← temps réel (Firebase / démo)
js/store.js    ← quiz + médias (IndexedDB)
js/ui.js       ← formes, couleurs, icônes
js/admin.js  js/host.js  js/play.js
js/vendor/qrcode.js  ← qrcode-generator (MIT), embarqué pour ne pas dépendre d'un CDN
```
