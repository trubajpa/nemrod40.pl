import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyD8R_NwbPp-T8LuTXpRm1cvZd9EWwxda0U',
  authDomain: 'nemrod40pl.firebaseapp.com',
  projectId: 'nemrod40pl',
  storageBucket: 'nemrod40pl.firebasestorage.app',
  messagingSenderId: '595744183629',
  appId: '1:595744183629:web:1b21998292d78266b51304',
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
