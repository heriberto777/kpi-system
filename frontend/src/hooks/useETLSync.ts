import { useETLContext } from '../contexts/ETLContext';

export function useETLSync() {
  const { isSyncing, syncProgress, triggerManualSync, pauseSync, resumeSync, isPaused } = useETLContext();
  return { isSyncing, syncProgress, triggerManualSync, pauseSync, resumeSync, isPaused };
}
