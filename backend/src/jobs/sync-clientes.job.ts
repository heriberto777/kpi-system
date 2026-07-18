import { ETLService } from '../services/etl.service';

export async function syncClientesJob(): Promise<void> {
  await ETLService.syncClientes(false);
}
