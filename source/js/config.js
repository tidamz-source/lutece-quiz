// Les réglages sont dans config.js à la racine (modifiable sans rebuild).
const C = window.LUTECE_CONFIG || {};

export const FIREBASE_CONFIG = C.firebase || {};
export const LEADERBOARD_EVERY = C.leaderboardEvery || 5;
export const AVATAR_COUNT = C.avatarCount || 30;
