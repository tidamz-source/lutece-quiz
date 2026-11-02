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
- **Question vidéo** : la vidéo est lue en entier sur le grand écran, puis les réponses s'affichent et le temps démarre. Après la révélation, bouton **Vidéo réponse** si tu en as ajouté une.
- **Scores secrets** : les téléphones indiquent seulement bonne ou mauvaise réponse. Le rang et les points n'apparaissent qu'à la toute fin.
- **Classement provisoire** (top 10) toutes les 5 questions : réglable via `leaderboardEvery` dans `config.js`.
- **Résultats** : podium révélé étape par étape (3e, 2e, puis le 1er avec explosion de confettis).

## Avatars et mascotte

- `avatars/avatar-01.png` … `avatar-30.png` : placeholders numérotés. Remplace-les par tes images en gardant les mêmes noms (carrées, 256×256 conseillé). Pour un autre nombre, change `avatarCount` dans `config.js`.
- `img/star-*.png` : la mascotte (point, happy, run, scheme).

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
