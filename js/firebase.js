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

// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {

//     function isSignedIn() { return request.auth != null; }
//     function isOwner(uid) { return request.auth.uid == uid; }
//     function isProfileMember(profileId) {
//       return get(/databases/$(database)/documents/profiles/$(profileId))
//                .data.members.hasAny([request.auth.uid]);
//     }

//     // User profiles (public read for friend lookup)
//     match /users/{uid} {
//       allow read:   if isSignedIn();
//       allow write:  if isSignedIn() && isOwner(uid);
//     }
    
//     // Username index (unique enforcement)
//     match /usernames/{username} {
//       allow read:   if isSignedIn();
//       allow create: if isSignedIn() && request.resource.data.uid == request.auth.uid;
//       allow delete: if isSignedIn() && resource.data.uid == request.auth.uid;
//     }
    
//     // Friend requests
//     match /friendships/{id} {
//       allow read:   if isSignedIn() &&
//                        (resource.data.fromUid == request.auth.uid ||
//                         resource.data.toUid   == request.auth.uid);
//       allow create: if isSignedIn() && request.resource.data.fromUid == request.auth.uid
//                        && request.resource.data.status == 'pending';
//       allow update: if isSignedIn() && resource.data.toUid == request.auth.uid
//                        && request.resource.data.status == 'accepted';
//       allow delete: if isSignedIn() &&
//                        (resource.data.fromUid == request.auth.uid ||
//                         resource.data.toUid   == request.auth.uid);
//     }
    
//     // Shared profiles
//     match /profiles/{profileId} {
//       // 수정된 부분: create와 read를 분리하고 조건문을 수정했습니다.
//       allow create: if isSignedIn() && request.auth.uid == request.resource.data.uid;
//       allow read:   if isSignedIn() && 
//                        (resource.data.uid == request.auth.uid || 
//                         resource.data.members.hasAny([request.auth.uid]));
//       allow update: if isSignedIn() && resource.data.members.hasAny([request.auth.uid]);
//       allow delete: if isSignedIn() && resource.data.uid == request.auth.uid;
//     }
    
//     // Transactions & budgets — any profile member can read/write
//     match /transactions/{txId} {
//       allow create: if isSignedIn() && isProfileMember(request.resource.data.profileId);
//       allow read, update, delete: if isSignedIn() && isProfileMember(resource.data.profileId);
//     }
//     match /budgets/{budgetId} {
//       allow create: if isSignedIn() && isProfileMember(request.resource.data.profileId);
//       allow read, update, delete: if isSignedIn() && isProfileMember(resource.data.profileId);
//     }
//   }
// }
