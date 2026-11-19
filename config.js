// ═══════════════════════════════════════════════════════════════
//  LUTÈCE QUIZ · RÉGLAGES
//  Ouvre ce fichier avec un éditeur de texte (Bloc-notes, TextEdit…),
//  modifie, enregistre. Aucune autre manipulation n'est nécessaire.
// ═══════════════════════════════════════════════════════════════

window.LUTECE_CONFIG = {

  // ── Firebase ───────────────────────────────────────────────
  // Colle ici l'objet firebaseConfig donné par la console Firebase.
  // Laissé vide → MODE DÉMO LOCAL (tout dans un seul navigateur).
  firebase: {
	apiKey: "AIzaSyDjgesIgFFVDhWPdSLW7YJbNZJQIOIFONM",
  	authDomain: "lutece-quiz.firebaseapp.com",
  	databaseURL: "https://lutece-quiz-default-rtdb.europe-west1.firebasedatabase.app",
  	projectId: "lutece-quiz",
  	storageBucket: "lutece-quiz.firebasestorage.app",
  	messagingSenderId: "1056586361192",
  	appId: "1:1056586361192:web:4cdb91fd4f24a7fa0d4edd",
  	measurementId: "G-SSBDCZGTW1"
  },

  // ── Jeu ────────────────────────────────────────────────────
  leaderboardEvery: 5,   // classement provisoire (top 10) toutes les N questions
  avatarCount: 30,       // nombre de fichiers avatars/avatar-01.png … avatar-NN.png
};
