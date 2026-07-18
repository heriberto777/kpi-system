import { ETLService } from '../services/etl.service';

export async function syncArticulosJob(): Promise<void> {
  await ETLService.syncArticulos(false);
}
