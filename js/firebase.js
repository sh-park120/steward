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
