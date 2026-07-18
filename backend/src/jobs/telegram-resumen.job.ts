import { TelegramService } from '../services/telegram.service';

export async function telegramResumenJob(): Promise<void> {
  await TelegramService.enviarResumenDiario();
}
