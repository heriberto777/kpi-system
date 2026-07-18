import { useETLContext } from '../contexts/ETLContext';

export function useSyncStatus() {
  const { isSyncing, lastSync, nextSync, syncProgress, progressDetails, loadStatus } = useETLContext();
  return { isSyncing, lastSync, nextSync, syncProgress, progressDetails, loadStatus };
}
