import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'AIzaSyD8R_NWbPp-T8luTXpRm1cvZd9EWwxda0U',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'nemrod40pl.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'nemrod40pl',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'nemrod40pl.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '595744183629',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '1:595744183629:web:1b21998292d78266b51304',
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
