// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, push, onValue, remove, update, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = { 
  apiKey: "AIzaSyBeUaOyesw9ucpBGumNjrzUp3WfUtXu39w", 
  authDomain: "growthogether.firebaseapp.com", 
  databaseURL: "https://growthogether-default-rtdb.asia-southeast1.firebasedatabase.app", 
  projectId: "growthogether", 
  storageBucket: "growthogether.firebasestorage.app", 
  messagingSenderId: "784796645743", 
  appId: "1:784796645743:web:e4eb40810d3051826d909a" 
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { 
  db, 
  ref, 
  set, 
  push, 
  onValue, 
  remove, 
  update, 
  get 
};