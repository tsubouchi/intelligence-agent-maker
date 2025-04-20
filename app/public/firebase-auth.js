// Firebase SDK をインポート
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyAn0A-ArnRnpv0GDa6ibAsqv63QAw0_W-E",
  authDomain: "project-iam-autospec.firebaseapp.com", 
  projectId: "project-iam-autospec",
  storageBucket: "project-iam-autospec.appspot.com",
  messagingSenderId: "1024909768846",
  appId: "1:1024909768846:web:ca0b6a7c69d5edd09ac92a"
};

// Firebase を初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// ログイン処理
function login() {
  signInWithPopup(auth, provider)
    .then((result) => {
      const user = result.user;
      document.getElementById("userInfo").textContent = `ログイン成功: ${user.displayName}`;
    })
    .catch((error) => {
      console.error("ログインエラー:", error);
      document.getElementById("userInfo").textContent = `ログイン失敗: ${error.message}`;
    });
}

window.login = login;
