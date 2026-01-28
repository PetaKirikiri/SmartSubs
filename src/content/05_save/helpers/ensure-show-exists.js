/**
 * Ensure Show Exists Helper
 * Checks if show document exists in Firebase, creates it if missing
 */

import { db } from '../../utils/firebaseConfig.js';
import { doc, getDocFromServer, setDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Ensure show document exists in Firebase
 * Checks if show exists, creates it if missing
 * @param {string} showName - Show name
 * @returns {Promise<void>}
 */
export async function ensureShowExists(showName) {
  if (!showName) return;
  
  // Check if show document exists
  const showRef = doc(db, 'shows', showName);
  const showDoc = await getDocFromServer(showRef);
  
  // Create show if it doesn't exist
  if (!showDoc.exists()) {
    await setDoc(showRef, {
      name: showName,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }
}
