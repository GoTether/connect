// /assets/js/firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAZoL7FPJ8wBqz_sX81Fo5eKXpsOVrLUZ0",
  authDomain: "tether-71e0c.firebaseapp.com",
  databaseURL: "https://tether-71e0c-default-rtdb.firebaseio.com",
  projectId: "tether-71e0c",
  storageBucket: "tether-71e0c.appspot.com",
  messagingSenderId: "277809008742",
  appId: "1:277809008742:web:2586a2b821d8da8f969da7"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let userId = localStorage.getItem("tether_user_id");
if (!userId) {
  signInAnonymously(auth).then((result) => {
    userId = result.user.uid;
    localStorage.setItem("tether_user_id", userId);
  }).catch((error) => {
    console.error("Anonymous login failed:", error);
  });
} else {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      signInAnonymously(auth).then((result) => {
        userId = result.user.uid;
        localStorage.setItem("tether_user_id", userId);
      }).catch((error) => {
        console.error("Re-login failed:", error);
      });
    }
  });
}

export { db, userId };
