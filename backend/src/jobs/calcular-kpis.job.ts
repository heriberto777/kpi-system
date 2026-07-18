import { ETLService } from '../services/etl.service';

export async function calcularKpisJob(): Promise<void> {
  await ETLService.calcularKpis(false);
}
