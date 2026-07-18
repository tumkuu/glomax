const { initializeApp } = require("firebase/app");
const { getDatabase } = require("firebase/database");
const { getFirestore } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyB1A1vEvKp4h8E6BB4SRzw_NPecFuLuJXY",
  authDomain: "glomax-657d7.firebaseapp.com",
  databaseURL: "https://glomax-657d7-default-rtdb.firebaseio.com",
  projectId: "glomax-657d7",
  storageBucket: "glomax-657d7.firebasestorage.app",
  messagingSenderId: "215428340917",
  appId: "1:215428340917:web:87ac6ebcc6dcddf1b6f2fc",
  measurementId: "G-3JDM9ZB9DK"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const firestore = getFirestore(app);

module.exports = { app, database, firestore, firebaseConfig };
