# Live tracking session expiry design

## Goal

Keep SOS location and profile data available to a trusted contact for up to 24 hours after the SOS starts, then make the link inactive and remove the Firebase record automatically.

## Current behavior

- `EmergencyContext` creates the tracking session ID and clears the Firebase node when the user cancels SOS.
- `LocationTracker` writes a location every five seconds while SOS is active.
- `/track/:sessionId` subscribes to the whole Firebase node and has no durable expiry metadata.
- The setup guide's example Realtime Database rules permit unauthenticated reads and writes, and there is no Cloud Functions project configuration.

## Proposed behavior

1. At SOS activation, create immutable `createdAt` and `expiresAt` epoch-millisecond values, with `expiresAt = createdAt + 24 hours`.
2. Include the same expiry metadata in session/profile and location writes. It must not slide forward as location updates arrive. Stop location writes at expiry.
3. On the tracking page, check the expiry locally, immediately hide the profile and map when the 24-hour deadline passes, show an explicit expired-link state, and stop listening to that Firebase node.
4. Add a scheduled Firebase Cloud Function that runs hourly and removes expired `/locations/<sessionId>` nodes. For older records without `expiresAt`, use the last location timestamp (or profile update timestamp if there is no location) plus 24 hours as the cleanup deadline.
5. Supply deployable Firebase configuration and Realtime Database rules. Rules should allow reads only while a session is unexpired, constrain new expiry values to at most 24 hours ahead, and prevent clients from extending an existing expiry. Keep immediate cancel cleanup available.
6. Update the Firebase integration guide with setup, deployment, plan requirements, hourly cleanup timing, and the fact that no live Firebase project will be changed by this code task.

## Data contract

```text
locations/<sessionId>
  createdAt: number     # epoch milliseconds; fixed at SOS activation
  expiresAt: number     # createdAt + 24 hours; immutable
  lat: number           # latest known location, optional
  lng: number           # latest known location, optional
  timestamp: number     # latest location update time, optional
  profile:              # current profile payload, optional
    ...
```

The session ID remains the same across the email URL and Firebase node. Existing sessions with no expiration metadata remain readable until the scheduled function's legacy cleanup reaches them, but new code must never create another unbounded record.

## Files likely to change

- `frontend/src/contexts/EmergencyContext.jsx`
- `frontend/src/features/tracking/firebaseClient.js`
- `frontend/src/features/tracking/LocationTracker.jsx`
- `frontend/src/pages/Track/Track.jsx` and `track.css`
- Root Firebase configuration and Realtime Database rules
- Cloud Functions source and package manifest
- `INTEGRATIONS_SETUP.md` and `README.md` if setup commands need a summary

## Safety and operational constraints

- Firebase Realtime Database and Cloud Functions are optional integrations; if Firebase is unavailable, SOS email and the rest of the emergency flow must continue.
- The app's local SQLite authentication is not Firebase Authentication. Existing public-link read behavior remains for active session URLs; this change limits access by session expiry but does not add user authentication to Firebase.
- The hourly schedule means physical deletion can happen up to about one hour after expiry. The tracking UI and database rules should stop serving expired records at the 24-hour deadline.
- Scheduled Cloud Functions require Firebase/Google Cloud billing setup. No deploy, live rule change, database read, or integration check is in scope.
- No test, build, emulator, or deploy commands will be run unless the user asks for verification.

## Review checklist for implementation

- A location/profile write cannot create a session without fixed expiry metadata.
- Location updates preserve the initial `expiresAt`; updates after expiry fail closed.
- The tracking page hides exact coordinates and profile data after expiry, including if the page stays open across the deadline.
- Cleanup handles expired new sessions and legacy records without printing location or profile data.
- SOS delivery and cancellation behavior continue to work when Firebase is missing or cleanup is delayed.
- Docs clearly state that scheduled cleanup needs deployment and billing configuration.
