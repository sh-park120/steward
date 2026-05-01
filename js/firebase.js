import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAjK3PQBuu6J888-PSLpq-SW6zvZUux6dM",
    authDomain: "steward-260124.firebaseapp.com",
    projectId: "steward-260124",
    storageBucket: "steward-260124.firebasestorage.app",
    messagingSenderId: "636184848666",
    appId: "1:636184848666:web:71201464b737e6bb7c64a3"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// ── FIRESTORE SECURITY RULES (paste into Firebase console) ──
//
// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {

//     function isSignedIn() { return request.auth != null; }

//     // Safe member check: handles old profiles that don't have a members field yet.
//     // Falls back to owner check so migration updateDoc calls are allowed.
//     function isProfileMember(profileId) {
//       let d = get(/databases/$(database)/documents/profiles/$(profileId)).data;
//       return d.uid == request.auth.uid
//           || d.get('members', []).hasAny([request.auth.uid]);
//     }

//     // ── users ──
//     match /users/{uid} {
//       allow read:  if isSignedIn();
//       allow write: if isSignedIn() && request.auth.uid == uid;
//     }

//     // ── usernames (unique index) ──
//     match /usernames/{username} {
//       allow read:   if isSignedIn();
//       allow create: if isSignedIn() && request.resource.data.uid == request.auth.uid;
//       allow delete: if isSignedIn() && resource.data.uid == request.auth.uid;
//     }

//     // ── friendships ──
//     match /friendships/{id} {
//       allow read:   if isSignedIn() && (resource.data.fromUid == request.auth.uid
//                                      || resource.data.toUid   == request.auth.uid);
//       allow create: if isSignedIn() && request.resource.data.fromUid == request.auth.uid
//                        && request.resource.data.status == 'pending';
//       allow update: if isSignedIn() && resource.data.toUid == request.auth.uid
//                        && request.resource.data.status == 'accepted';
//       allow delete: if isSignedIn() && (resource.data.fromUid == request.auth.uid
//                                      || resource.data.toUid   == request.auth.uid);
//     }

//     // ── profiles ──
//     // update uses get('members', []) so it works for old profiles without a members field
//     // (needed so the migration updateDoc from loadProfiles can succeed)
//     match /profiles/{profileId} {
//       allow create: if isSignedIn() && request.auth.uid == request.resource.data.uid;
//       allow read:   if isSignedIn() && (resource.data.uid == request.auth.uid
//                        || resource.data.get('members', []).hasAny([request.auth.uid]));
//       allow update: if isSignedIn() && (resource.data.uid == request.auth.uid
//                        || resource.data.get('members', []).hasAny([request.auth.uid]));
//       allow delete: if isSignedIn() && resource.data.uid == request.auth.uid;
//     }

//     // ── budgetPlanners ──
//     match /budgetPlanners/{plannerId} {
//       allow create:              if isSignedIn() && isProfileMember(request.resource.data.profileId);
//       allow read, update, delete: if isSignedIn() && isProfileMember(resource.data.profileId);
//     }
//     // ── transactions & budgets ──
//     match /transactions/{txId} {
//       allow create:              if isSignedIn() && isProfileMember(request.resource.data.profileId);
//       allow read, update, delete: if isSignedIn() && isProfileMember(resource.data.profileId);
//     }
//     match /budgets/{budgetId} {
//       allow create:              if isSignedIn() && isProfileMember(request.resource.data.profileId);
//       allow read, update, delete: if isSignedIn() && isProfileMember(resource.data.profileId);
//     }
//   }
// }
