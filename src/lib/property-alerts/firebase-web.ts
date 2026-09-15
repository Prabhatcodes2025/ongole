export const firebaseWebConfig={
  apiKey:process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId:process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId:process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};
export const firebaseVapidKey=process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
export function firebaseWebConfigured(){return Object.values(firebaseWebConfig).every(Boolean)&&Boolean(firebaseVapidKey)}
