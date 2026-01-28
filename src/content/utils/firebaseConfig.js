import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDYO1mXdCdeFlkSWP9h0k33VyJ4Q8nYpbs",
  authDomain: "smartsubs-b348c.firebaseapp.com",
  projectId: "smartsubs-b348c",
  storageBucket: "smartsubs-b348c.firebasestorage.app",
  messagingSenderId: "404754105108",
  appId: "1:404754105108:web:654c35e1126ef537663801",
  measurementId: "G-0SWLMYZGCY"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export { getFirestore };



