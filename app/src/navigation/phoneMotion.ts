import { createMotionWindow } from './speedFilter';

// Shared with foreground recording. Background batches never reuse stale motion.
export const phoneMotion = createMotionWindow();
