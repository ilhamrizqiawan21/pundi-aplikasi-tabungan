import {
  KunciPinSchema,
  KunciAturSchema,
  KunciUbahSchema,
  KunciPulihkanSchema,
} from '../../../shared/schemas.js';
import type { IpcContext } from '../types.js';

export function registerKunciHandlers(ctx: IpcContext): void {
  const { handle, kunci } = ctx;

  handle('kunci.status', null, () => kunci.status());
  handle('kunci.buka', KunciPinSchema, (data) => kunci.buka(data.pin));
  handle('kunci.kunciSekarang', null, () => kunci.kunciSekarang());
  handle('kunci.atur', KunciAturSchema, (data) => kunci.atur(data.pin));
  handle('kunci.ubah', KunciUbahSchema, (data) => kunci.ubah(data.pinLama, data.pinBaru));
  handle('kunci.matikan', KunciPinSchema, (data) => kunci.matikan(data.pin));
  handle('kunci.pulihkan', KunciPulihkanSchema, (data) => kunci.pulihkan(data.kode, data.pinBaru));
}

