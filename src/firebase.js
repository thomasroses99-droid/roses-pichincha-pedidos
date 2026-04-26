import { initializeApp } from "firebase/app";
import { getFirestore, doc, onSnapshot, setDoc, getDoc, collection, addDoc, query, orderBy, limit, runTransaction, increment } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBwStyxPtR2aqUf1Fg91za4X3iRdjeMGAk",
  authDomain: "roses-burgers.firebaseapp.com",
  projectId: "roses-burgers",
  storageBucket: "roses-burgers.firebasestorage.app",
  messagingSenderId: "254575444987",
  appId: "1:254575444987:web:4e7a88da62977583ab815e",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export { doc, onSnapshot, setDoc, getDoc, collection, addDoc, query, orderBy, limit, runTransaction, increment, ref, uploadBytes, getDownloadURL, deleteObject };
