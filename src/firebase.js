import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAb9Jas5THnDl6j87uh8VDNL3T27iGuvYY",
  authDomain: "nkda-auction-2027.firebaseapp.com",
  databaseURL: "https://nkda-auction-2027-default-rtdb.firebaseio.com",
  projectId: "nkda-auction-2027",
  storageBucket: "nkda-auction-2027.firebasestorage.app",
  messagingSenderId: "298971142809",
  appId: "1:298971142809:web:c3b71bd238286080547608"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);