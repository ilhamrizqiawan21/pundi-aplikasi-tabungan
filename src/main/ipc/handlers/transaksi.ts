import {
  TransaksiSetorSchema,
  TransaksiSetorMassalSchema,
  BiayaAdmRencanaSchema,
  BiayaAdmTerapkanSchema,
  TransaksiTarikSchema,
  TransaksiBalikSchema,
  TransaksiRiwayatSchema,
} from '../../../shared/schemas.js';
import type { IpcContext } from '../types.js';

export function registerTransaksiHandlers(ctx: IpcContext): void {
  const { handle, ledger } = ctx;

  handle('transaksi.setor', TransaksiSetorSchema, (data) => ledger.setor(data));
  handle('transaksi.setorMassal', TransaksiSetorMassalSchema, (data) => ledger.setorMassal(data));
  handle('biayaAdm.rencana', BiayaAdmRencanaSchema, (data) => ledger.rencanaBiayaAdm(data));
  handle('biayaAdm.terapkan', BiayaAdmTerapkanSchema, (data) => ledger.biayaAdmMassal(data));
  handle('transaksi.tarik', TransaksiTarikSchema, (data) => ledger.tarik(data));
  handle('transaksi.balik', TransaksiBalikSchema, (data) => ledger.balik(data));
  handle('transaksi.riwayat', TransaksiRiwayatSchema, (data) => ledger.riwayat(data));
}

