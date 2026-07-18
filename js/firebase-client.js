/* global firebase */
(function (global) {
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

  if (!global.firebase) {
    console.error("Firebase SDK not loaded.");
    return;
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  const db = firebase.firestore();

  async function saveOrderToFirestore(orderData) {
    const ref = await db.collection("orders").add(orderData);
    return { id: ref.id, ...orderData };
  }

  async function deleteOrderFromFirestore(orderId) {
    if (!orderId) return;
    await db.collection("orders").doc(orderId).delete();
  }

  global.FirebaseOrders = {
    db,
    saveOrderToFirestore,
    deleteOrderFromFirestore,
    serverTimestamp: () => firebase.firestore.FieldValue.serverTimestamp()
  };
})(window);
