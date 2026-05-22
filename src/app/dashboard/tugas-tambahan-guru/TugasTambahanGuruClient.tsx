"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { useToast } from "@/components/ToastProvider";
import {
  cancelGuruTugasTambahanRequestAction,
  createGuruTugasTambahanRequestAction,
  decideGuruTugasTambahanRequestAction,
  listTeachersAtSchoolByIdForPickerAction,
  revokeApprovedGuruTugasTambahanNonSatHostAction,
  searchSchoolsByNpsnAction,
} from "@/server/actions/guru-tugas-tambahan";

type PendingRow = {
  id: string;
  createdAt: string;
  homeTeacher: {
    id: string;
    nama: string;
    nip: string | null;
    email: string;
    schoolNama: string | null;
    schoolNpsn: string | null;
  };
  hostSchool: { nama: string | null; npsn: string | null };
  initiatedBySchoolId: string;
  initiatedBy: { name: string | null; email: string | null };
};

type MineRow = {
  id: string;
  status: string;
  createdAt: string;
  rejectReason: string | null;
  hostIsSatminkal: boolean;
  homeTeacher: {
    id: string;
    nama: string;
    email: string;
    schoolNama: string | null;
    schoolNpsn: string | null;
  };
  hostSchool: { nama: string | null; npsn: string | null };
};

type HomeTeacherRow = { id: string; nama: string; nip: string | null; email: string };

export function TugasTambahanGuruClient(props: {
  tenantSchoolId: string;
  schoolName: string | null;
  schoolNpsn: string | null;
  isSatminkal: boolean;
  pending: PendingRow[];
  mine: MineRow[];
  homeTeachers: HomeTeacherRow[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const [npsnOut, setNpsnOut] = useState("");
  const [hitsOut, setHitsOut] = useState<{ id: string; namaSekolah: string | null; npsn: string | null }[]>([]);
  const [hostOutId, setHostOutId] = useState("");
  const [homeTeacherOutId, setHomeTeacherOutId] = useState("");

  const [npsnIn, setNpsnIn] = useState("");
  const [hitsIn, setHitsIn] = useState<{ id: string; namaSekolah: string | null; npsn: string | null }[]>([]);
  const [satminkalPickId, setSatminkalPickId] = useState("");
  const [remoteTeachers, setRemoteTeachers] = useState<HomeTeacherRow[]>([]);
  const [homeTeacherInId, setHomeTeacherInId] = useState("");

  const [rejectOpenId, setRejectOpenId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [batalNonSatId, setBatalNonSatId] = useState<string | null>(null);

  const statusLabel = useMemo(
    () =>
      ({
        PENDING: "Menunggu persetujuan",
        APPROVED: "Disetujui",
        REJECTED: "Ditolak",
        CANCELLED: "Dibatalkan",
      }) as Record<string, string>,
    [],
  );

  async function runSearchOut() {
    setBusy(true);
    const rows = await searchSchoolsByNpsnAction(npsnOut);
    setBusy(false);
    setHitsOut(rows);
    setHostOutId(rows[0]?.id ?? "");
    if (rows.length === 0) toast("Tidak ada sekolah lain dengan NPSN cocok.", "warning");
  }

  async function runSearchIn() {
    setBusy(true);
    const rows = await searchSchoolsByNpsnAction(npsnIn);
    setHitsIn(rows);
    const first = rows[0]?.id ?? "";
    setSatminkalPickId(first);
    setRemoteTeachers([]);
    setHomeTeacherInId("");
    if (first) {
      const r = await listTeachersAtSchoolByIdForPickerAction(first);
      if (!r.ok) {
        toast(r.message, "error");
      } else {
        const mapped = r.teachers.map((t) => ({
          id: t.id,
          nama: t.nama,
          nip: t.nip,
          email: t.user.email,
        }));
        setRemoteTeachers(mapped);
        setHomeTeacherInId(mapped[0]?.id ?? "");
      }
    }
    setBusy(false);
    if (rows.length === 0) toast("Tidak ada sekolah dengan NPSN cocok.", "warning");
  }

  async function submitSatminkalOut(e: React.FormEvent) {
    e.preventDefault();
    if (!hostOutId || !homeTeacherOutId) {
      toast("Lengkapi pilihan guru dan sekolah tujuan.", "error");
      return;
    }
    setBusy(true);
    const r = await createGuruTugasTambahanRequestAction({
      homeTeacherId: homeTeacherOutId,
      hostSchoolId: hostOutId,
    });
    setBusy(false);
    if (!r.ok) toast(r.message, "error");
    else {
      toast("Permohonan tugas tambahan dikirim.", "success");
      setNpsnOut("");
      setHitsOut([]);
      setHostOutId("");
      router.refresh();
    }
  }

  async function submitNonSatminkalIn(e: React.FormEvent) {
    e.preventDefault();
    if (!satminkalPickId || !homeTeacherInId) {
      toast("Pilih sekolah satminkal dan guru induk.", "error");
      return;
    }
    setBusy(true);
    const r = await createGuruTugasTambahanRequestAction({
      homeTeacherId: homeTeacherInId,
      hostSchoolId: props.tenantSchoolId,
    });
    setBusy(false);
    if (!r.ok) toast(r.message, "error");
    else {
      toast("Permohonan tugas tambahan dikirim.", "success");
      router.refresh();
    }
  }

  async function approve(id: string) {
    setBusy(true);
    const r = await decideGuruTugasTambahanRequestAction({ requestId: id, approve: true, rejectReason: null });
    setBusy(false);
    if (!r.ok) toast(r.message, "error");
    else {
      toast("Permohonan disetujui.", "success");
      router.refresh();
    }
  }

  async function reject(id: string) {
    const reason = rejectReason.trim();
    if (!reason) {
      toast("Isi alasan penolakan.", "error");
      return;
    }
    setBusy(true);
    const r = await decideGuruTugasTambahanRequestAction({
      requestId: id,
      approve: false,
      rejectReason: reason,
    });
    setBusy(false);
    if (!r.ok) toast(r.message, "error");
    else {
      toast("Permohonan ditolak.", "success");
      setRejectOpenId(null);
      setRejectReason("");
      router.refresh();
    }
  }

  async function cancelMine(id: string) {
    setBusy(true);
    const r = await cancelGuruTugasTambahanRequestAction({ requestId: id });
    setBusy(false);
    if (!r.ok) toast(r.message, "error");
    else {
      toast("Permohonan dibatalkan.", "success");
      router.refresh();
    }
  }

  async function revokeBatalNonSat(id: string) {
    setBusy(true);
    const r = await revokeApprovedGuruTugasTambahanNonSatHostAction({ requestId: id });
    setBusy(false);
    setBatalNonSatId(null);
    if (!r.ok) toast(r.message, "error");
    else {
      toast("Penugasan non-satminkal dibatalkan dari sekolah induk.", "success");
      router.refresh();
    }
  }

  return (
    <div className="min-w-0 space-y-8">
      <div className="max-w-3xl space-y-1">
        <h1 className="ui-page-title">Tugas tambahan guru</h1>
        <p className="ui-muted text-pretty">
          Guru induk harus berada di sekolah <strong>satminkal</strong>. Persetujuan dilakukan oleh admin sekolah
          lawan. Sekolah Anda:{" "}
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {props.schoolName ?? "—"}
          </span>{" "}
          {props.schoolNpsn ? (
            <span className="ui-muted">
              (NPSN {props.schoolNpsn}) — {props.isSatminkal ? "satminkal" : "non-satminkal"}
            </span>
          ) : null}
        </p>
      </div>

      <aside className="max-w-3xl rounded-2xl border border-sky-200/90 bg-sky-50/80 p-4 text-sm leading-relaxed text-slate-800 dark:border-sky-900/55 dark:bg-sky-950/40 dark:text-slate-200">
        <p className="font-semibold text-slate-900 dark:text-slate-50">Informasi</p>
        <p className="mt-2 text-pretty">
          {props.isSatminkal ? (
            <>
              Jika mitra Anda (misalnya sekolah <strong>non-satminkal</strong>) sudah ada guru dari sekolah Anda yang
              mengajar tetapi penugasan di aplikasi ini belum lengkap, sekolah satminkal dapat mengajukan{" "}
              <strong>tugas tambahan</strong> ke sekolah tersebut lewat formulir di bawah setelah koordinasi dengan
              admin sekolah tujuan.
            </>
          ) : (
            <>
              Jika di sekolah Anda sudah ada <strong>guru yang induknya di sekolah satminkal</strong> dan mengajar,
              tetapi belum tercatat lewat fitur ini, minta <strong>admin sekolah satminkal</strong> yang menaungi guru
              tersebut untuk mengajukan atau menyelesaikan permohonan tugas tambahan ke sekolah Anda, agar penugasan
              dan akses di aplikasi selaras.
            </>
          )}
        </p>
        <p className="mt-3 text-pretty">
          Untuk memastikan sekolah (satminkal atau tujuan) <strong>sudah terdaftar di basis data</strong> aplikasi,
          gunakan <strong>pencarian NPSN</strong> pada form di halaman ini. Jika tidak ada hasil, sekolah tersebut
          belum ada di data — daftarkan atau pastikan pendaftaran sekolah selesai lebih dulu (misalnya melalui jalur
          administrator).
        </p>
      </aside>

      {props.isSatminkal ? (
        <section className="ui-card ui-card-tight space-y-4">
          <h2 className="ui-section-title">Ajukan tugas tambahan (dari satminkal)</h2>
          <p className="ui-muted text-sm text-pretty">
            Pilih guru di sekolah Anda, lalu cari NPSN sekolah tujuan (non-satminkal atau satminkal lain) yang terdaftar
            di aplikasi.
          </p>
          <form onSubmit={submitSatminkalOut} className="space-y-4">
            <label className="ui-label">
              Guru induk (satminkal Anda)
              <select
                required
                className="ui-select mt-1.5"
                value={homeTeacherOutId}
                onChange={(e) => setHomeTeacherOutId(e.target.value)}
              >
                <option value="">— Pilih guru —</option>
                {props.homeTeachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nama} ({t.email})
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap items-end gap-2">
              <label className="ui-label min-w-[12rem] flex-1">
                Cari NPSN sekolah tujuan
                <input
                  className="ui-input mt-1.5"
                  value={npsnOut}
                  onChange={(e) => setNpsnOut(e.target.value)}
                  placeholder="Minimal 4 digit"
                  inputMode="numeric"
                />
              </label>
              <button type="button" disabled={busy} className="ui-btn ui-btn-primary" onClick={() => void runSearchOut()}>
                Cari
              </button>
            </div>
            {hitsOut.length > 0 ? (
              <label className="ui-label">
                Pilih sekolah tujuan
                <select
                  required
                  className="ui-select mt-1.5"
                  value={hostOutId}
                  onChange={(e) => setHostOutId(e.target.value)}
                >
                  {hitsOut.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.namaSekolah ?? s.id} {s.npsn ? `(NPSN ${s.npsn})` : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button type="submit" disabled={busy || props.homeTeachers.length === 0} className="ui-btn ui-btn-success">
              Kirim permohonan
            </button>
          </form>
        </section>
      ) : (
        <section className="ui-card ui-card-tight space-y-4">
          <h2 className="ui-section-title">Ajukan tugas tambahan (dari non-satminkal)</h2>
          <p className="ui-muted text-sm text-pretty">
            Cari sekolah <strong>satminkal</strong> lewat NPSN, pilih guru induk di sana, lalu kirim permohonan agar guru
            tersebut mendapat tugas di sekolah Anda.
          </p>
          <form onSubmit={submitNonSatminkalIn} className="space-y-4">
            <div className="flex flex-wrap items-end gap-2">
              <label className="ui-label min-w-[12rem] flex-1">
                Cari NPSN sekolah satminkal
                <input
                  className="ui-input mt-1.5"
                  value={npsnIn}
                  onChange={(e) => setNpsnIn(e.target.value)}
                  placeholder="Minimal 4 digit"
                  inputMode="numeric"
                />
              </label>
              <button type="button" disabled={busy} className="ui-btn ui-btn-primary" onClick={() => void runSearchIn()}>
                Cari
              </button>
            </div>
            {hitsIn.length > 0 ? (
              <>
                <label className="ui-label">
                  Pilih sekolah satminkal
                  <select
                    className="ui-select mt-1.5"
                    value={satminkalPickId}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSatminkalPickId(v);
                      void (async () => {
                        setBusy(true);
                        const r = await listTeachersAtSchoolByIdForPickerAction(v);
                        setBusy(false);
                        if (!r.ok) {
                          toast(r.message, "error");
                          setRemoteTeachers([]);
                          setHomeTeacherInId("");
                          return;
                        }
                        const mapped = r.teachers.map((t) => ({
                          id: t.id,
                          nama: t.nama,
                          nip: t.nip,
                          email: t.user.email,
                        }));
                        setRemoteTeachers(mapped);
                        setHomeTeacherInId(mapped[0]?.id ?? "");
                      })();
                    }}
                  >
                    {hitsIn.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.namaSekolah ?? s.id} {s.npsn ? `(NPSN ${s.npsn})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ui-label">
                  Guru induk di satminkal tersebut
                  <select
                    required
                    className="ui-select mt-1.5"
                    value={homeTeacherInId}
                    onChange={(e) => setHomeTeacherInId(e.target.value)}
                  >
                    <option value="">— Pilih guru —</option>
                    {remoteTeachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nama} ({t.email})
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
            <button type="submit" disabled={busy} className="ui-btn ui-btn-success">
              Kirim permohonan
            </button>
          </form>
        </section>
      )}

      <section className="ui-card ui-card-tight space-y-3">
        <h2 className="ui-section-title">Persetujuan untuk sekolah Anda</h2>
        {props.pending.length === 0 ? (
          <p className="ui-muted text-sm">Tidak ada permohonan yang menunggu keputusan Anda.</p>
        ) : (
          <ul className="space-y-3">
            {props.pending.map((p) => (
              <li
                key={p.id}
                className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-slate-700/80 dark:bg-slate-800/80"
              >
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {p.homeTeacher.nama} — {p.homeTeacher.email}
                </p>
                <p className="ui-muted mt-1 text-xs">
                  Induk: {p.homeTeacher.schoolNama ?? "—"}{" "}
                  {p.homeTeacher.schoolNpsn ? `(NPSN ${p.homeTeacher.schoolNpsn})` : ""}
                </p>
                <p className="ui-muted mt-1 text-xs">
                  Tujuan tugas: {p.hostSchool.nama ?? "—"}{" "}
                  {p.hostSchool.npsn ? `(NPSN ${p.hostSchool.npsn})` : ""}
                </p>
                <p className="ui-muted mt-1 text-xs">
                  Diajukan: {new Date(p.createdAt).toLocaleString("id-ID")} — {p.initiatedBy.name ?? p.initiatedBy.email}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={busy} className="ui-btn ui-btn-success ui-btn-sm" onClick={() => void approve(p.id)}>
                    Setujui
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="ui-btn ui-btn-ghost ui-btn-sm"
                    onClick={() => {
                      setRejectOpenId(p.id);
                      setRejectReason("");
                    }}
                  >
                    Tolak…
                  </button>
                </div>
                {rejectOpenId === p.id ? (
                  <div className="mt-3 space-y-2 rounded-xl border border-slate-200/80 p-3 dark:border-slate-700/80">
                    <label className="ui-label text-sm">
                      Alasan penolakan
                      <textarea
                        className="ui-input mt-1 min-h-[4rem] resize-y"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" disabled={busy} onClick={() => void reject(p.id)}>
                        Kirim penolakan
                      </button>
                      <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => setRejectOpenId(null)}>
                        Batal
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ui-card ui-card-tight space-y-3">
        <h2 className="ui-section-title">Permohonan dari sekolah Anda</h2>
        {props.mine.length === 0 ? (
          <p className="ui-muted text-sm">Belum ada permohonan yang dikirim dari sekolah ini.</p>
        ) : (
          <ul className="divide-y divide-slate-200/80 dark:divide-slate-700/80">
            {props.mine.map((m) => {
              const approved =
                String(m.status).toUpperCase() === "APPROVED";
              /** Semua permohonan "dari sekolah Anda" di tenant satminkal = pengajuan induk → host; tampilkan
               *  setelah disetujui walau host di DB masih `isSatminkal: true` (nilai default skema). */
              const showBatalNonSat = props.isSatminkal && approved;
              return (
              <li key={m.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {m.homeTeacher.nama} → {m.hostSchool.nama ?? "sekolah tujuan"}
                    </p>
                    <p className="ui-muted mt-0.5 text-xs">
                      {statusLabel[m.status] ?? m.status} · {new Date(m.createdAt).toLocaleString("id-ID")}
                    </p>
                    {m.rejectReason ? (
                      <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">{m.rejectReason}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {m.status === "PENDING" ? (
                      <button type="button" disabled={busy} className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => void cancelMine(m.id)}>
                        Batalkan
                      </button>
                    ) : null}
                    {showBatalNonSat ? (
                      <button
                        type="button"
                        disabled={busy}
                        className="ui-btn ui-btn-ghost ui-btn-sm !text-amber-800 hover:!bg-amber-50 dark:!text-amber-200 dark:hover:!bg-amber-950/45"
                        onClick={() => setBatalNonSatId((cur) => (cur === m.id ? null : m.id))}
                      >
                        Batal Non-Satminkal
                      </button>
                    ) : null}
                  </div>
                </div>
                {batalNonSatId === m.id ? (
                  <div className="mt-3 space-y-2 rounded-xl border border-amber-200/90 bg-amber-50/60 p-3 dark:border-amber-800/50 dark:bg-amber-950/30">
                    <p className="text-xs leading-relaxed text-amber-950 dark:text-amber-100">
                      Batalkan penugasan guru ini di <strong>sekolah tujuan</strong>? Baris guru dan penugasan mapel di
                      sana akan dihapus; akun guru di sekolah Anda (induk) tetap ada.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        className="ui-btn ui-btn-primary ui-btn-sm"
                        onClick={() => void revokeBatalNonSat(m.id)}
                      >
                        Ya, batalkan penugasan
                      </button>
                      <button
                        type="button"
                        className="ui-btn ui-btn-ghost ui-btn-sm"
                        disabled={busy}
                        onClick={() => setBatalNonSatId(null)}
                      >
                        Tutup
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
