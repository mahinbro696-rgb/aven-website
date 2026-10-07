import { getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

import { firebaseConfig } from "./firebase-config";
export { firebaseConfig } from "./firebase-config";

const app = getApps().find((item) => item.name === "[DEFAULT]") || initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
