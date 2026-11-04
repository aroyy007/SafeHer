'use strict';

const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { defineString } = require('firebase-functions/params');
const { onSchedule } = require('firebase-functions/v2/scheduler');

const TRACKING_TTL_MS = 24 * 60 * 60 * 1000;
const firebaseDatabaseUrl = defineString('FIREBASE_DATABASE_URL');

initializeApp();

exports.cleanupExpiredTrackingSessions = onSchedule({
  schedule: 'every 60 minutes',
  timeZone: 'Asia/Dhaka',
  maxInstances: 1,
}, async () => {
  const now = Date.now();
  const database = getDatabase(undefined, firebaseDatabaseUrl.value());
  const expiredSnapshot = await database
    .ref('locations')
    .orderByChild('expiresAt')
    .endAt(now)
    .once('value');

  const removals = [];
  expiredSnapshot.forEach((sessionSnapshot) => {
    const session = sessionSnapshot.val() || {};
    const explicitExpiry = Number(session.expiresAt);
    const lastActivity = Number(session.timestamp) || Number(session.profile?.updatedAt);
    const expiresAt = Number.isFinite(explicitExpiry) && explicitExpiry > 0
      ? explicitExpiry
      : (Number.isFinite(lastActivity) && lastActivity > 0 ? lastActivity + TRACKING_TTL_MS : 0);

    // No usable timestamp means the old record cannot be shown to be within
    // its retention window, so remove it for privacy.
    if (!expiresAt || expiresAt <= now) removals.push(sessionSnapshot.ref.remove());
  });

  await Promise.all(removals);
  console.info(`Removed ${removals.length} expired tracking session(s).`);
});
