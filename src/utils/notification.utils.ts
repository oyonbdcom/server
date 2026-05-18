// notification.utils.ts (Backend)
import admin from 'firebase-admin';

export const sendBatchNotification = async (tokens: string[], title: string, body: string) => {
  if (tokens.length === 0) return;

  const message = {
    notification: { title, body },
    tokens: tokens,
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`${response.successCount} messages were sent successfully`);
  } catch (error) {
    console.error('Error sending batch notification:', error);
  }
};

/**
 * Firestore-এ ডক্টরের লাইভ সেশন আপডেট করার ইউটিলিতি
 * @param doctorId - ডক্টরের আইডি
 * @param clinicId - ক্লিনিকের আইডি
 * @param data - যা আপডেট করতে চান (status, runningSerial ইত্যাদি)
 */
export const updateLiveSessionInFirestore = async (
  doctorId: string,
  clinicId: string,
  data: { runningSerial?: number; status: string },
) => {
  try {
    const db = admin.firestore();

    const docId = `${doctorId}_${clinicId}`;

    const sessionRef = db.collection('live_sessions').doc(docId);

    await sessionRef.set(
      {
        doctorId,
        clinicId,
        runningSerial: data.runningSerial ?? 0,
        status: data.status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    console.log(`🔥 Firestore Updated for Doctor: ${doctorId}`);
  } catch (error) {
    console.error('❌ Firebase Firestore Update Error:', error);
    // এখানে এরর থ্রো করার দরকার নেই যাতে মেইন রিকোয়েস্ট সাকসেসফুল হয়
  }
};
