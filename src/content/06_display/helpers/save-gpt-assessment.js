/**
 * Save GPT Assessment - Save GPT sense assessment to Firestore
 */

import { db } from '../../utils/firebaseConfig.js';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Save GPT sense assessment to Firestore
 * @param {string} showName - Show name
 * @param {string} mediaId - Media ID
 * @param {string} subId - Subtitle ID
 * @param {number} tokenIndex - Token index
 * @param {object} assessment - Assessment object
 */
export async function saveGPTSenseAssessmentSave(showName, mediaId, subId, tokenIndex, assessment) {
  if (!showName || !mediaId || !subId || tokenIndex === null || tokenIndex === undefined || !assessment) {
    return;
  }
  
  try {
    const assessmentRef = doc(db, 'shows', showName, 'episodes', mediaId, 'subs', subId, 'assessments', String(tokenIndex));
    
    await setDoc(assessmentRef, {
      recommendedSenseIndex: assessment.recommendedSenseIndex,
      senseScores: assessment.senseScores || [],
      overallReasoning: assessment.overallReasoning || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    
  } catch (error) {
    // Failed to save assessment
  }
}
