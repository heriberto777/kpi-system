import { apiClient } from './client';
import { CronJobStatus, EstadoSincronizacion, EtlStatus, SyncLog, TipoSincronizacion } from '../types';

export interface LogsFilter {
  limit?: number;
  tipo?: TipoSincronizacion;
  estado?: EstadoSincronizacion;
}

export const etlApi = {
  async getStatus(): Promise<EtlStatus> {
    const { data } = await apiClient.get<EtlStatus>('/etl/status');
    return data;
  },

  async triggerSync(): Promise<{ mensaje: string; id_sync: number }> {
    const { data } = await apiClient.post('/etl/trigger-manual');
    return data;
  },

  async pauseSync(): Promise<{ mensaje: string }> {
    const { data } = await apiClient.post('/etl/pause');
    return data;
  },

  async resumeSync(): Promise<{ mensaje: string }> {
    const { data } = await apiClient.post('/etl/resume');
    return data;
  },

  async getJobsStatus(): Promise<{ pausado: boolean; jobs: CronJobStatus[] }> {
    const { data } = await apiClient.get('/etl/jobs');
    return data;
  },

  async getLogs(filter: LogsFilter = {}): Promise<SyncLog[]> {
    const { data } = await apiClient.get<SyncLog[]>('/etl/logs', { params: filter });
    return data;
  },

  async getLogById(id: number): Promise<SyncLog> {
    const { data } = await apiClient.get<SyncLog>(`/etl/logs/${id}`);
    return data;
  },

  async updateJob(
    name: string,
    patch: { cron_expresion?: string; habilitado?: boolean }
  ): Promise<CronJobStatus> {
    const { data } = await apiClient.put<CronJobStatus>(`/etl/jobs/${name}`, patch);
    return data;
  },

  async getConfig(): Promise<{
    mssql: { server: string; port: number; database: string; encrypt: boolean; configurado: boolean };
    telegram: { configurado: boolean };
  }> {
    const { data } = await apiClient.get('/etl/config');
    return data;
  },
};
