/**
 * Pipeline Saves Orchestrator
 * Exports all three stage save functions in a single object
 */

import { saveStage1 } from './stage1Save.js';
import { saveStage2 } from './stage2Save.js';
import { saveStage3 } from './stage3Save.js';

export default {
  saveStage1,
  saveStage2,
  saveStage3
};

