import { getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Public Firebase app identifiers, not administrator credentials.
export const firebaseConfig = {
  apiKey: "AIzaSyAq_x5gGXu1ZvYecN9KDiH2gZ92iGUcazE",
  authDomain: "aven-ba684.firebaseapp.com",
  projectId: "aven-ba684",
  storageBucket: "aven-ba684.firebasestorage.app",
  messagingSenderId: "773719891768",
  appId: "1:773719891768:web:48cd1d32aea86314b5abcd",
};
const app = getApps().find((item) => item.name === "[DEFAULT]") || initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
