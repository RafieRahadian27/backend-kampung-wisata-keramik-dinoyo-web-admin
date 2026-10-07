import { akunSeed } from "../data/akun.data";
import type { Akun, PeranAkun, StatusAkun } from "../types";
import { HttpError } from "../utils/httpError";

let akunList: Akun[] = structuredClone(akunSeed);

export interface AkunFilter {
  q?: string;
  peran?: PeranAkun;
  status?: StatusAkun;
}

export const akunService = {
  findAll(filter: AkunFilter = {}): Akun[] {
    const keyword = filter.q?.trim().toLowerCase();
    return akunList.filter((akun) => {
      const cocokKeyword =
        !keyword ||
        [akun.nama, akun.email, akun.nik].some((field) => field.toLowerCase().includes(keyword));
      const cocokPeran = !filter.peran || akun.peran === filter.peran;
      const cocokStatus = !filter.status || akun.status === filter.status;
      return cocokKeyword && cocokPeran && cocokStatus;
    });
  },

  ringkasan() {
    return { total: 34, aktif: 31, menunggu: 3, sesiHariIni: 19, tokoAktif: 28, persenAktifPekan: 82 };
  },

  updateStatus(id: number, status: StatusAkun): Akun {
    const akun = akunList.find((item) => item.id === id);
    if (!akun) throw new HttpError(404, "Akun tidak ditemukan");
    const updated = { ...akun, status };
    akunList = akunList.map((item) => (item.id === id ? updated : item));
    return updated;
  },
};
