// src/app/utils/firebaseAdmin.ts
import admin from 'firebase-admin';
import config from '../config/config';

export const initializeFirebase = () => {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: config.firebase.projectId,
        clientEmail: config.firebase.clientEmail,
        privateKey: config.firebase.privateKey,
      }),
    });
    console.log('Successfully connected ');
  }
};
