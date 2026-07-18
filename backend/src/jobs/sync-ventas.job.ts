import { ETLService } from '../services/etl.service';

export async function syncVentasJob(): Promise<void> {
  await ETLService.syncVentas(false);
}
