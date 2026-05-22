"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";

import { useToast } from "@/components/ToastProvider";
import {
  createClassRoomAction,
  deleteClassRoomAction,
  editClassRoomAction,
  listClassRoomsAction,
  setHomeroomTeacherAction,
  type ClassRoomItem,
} from "@/server/actions/akademik";

export function KelasClient(props: {
  years: { id: string; label: string }[];
  teachers: { id: string; nama: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [yearId, setYearId] = useState(props.years[0]?.id ?? "");
  const [classes, setClasses] = useState<ClassRoomItem[]>([]);
  const [busy, setBusy] = useState(false);

  const [editTarget, setEditTarget] = useState<ClassRoomItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClassRoomItem | null>(null);
  const [homeroomTarget, setHomeroomTarget] = useState<ClassRoomItem | null>(null);

  const load = useCallback(async () => {
    if (!yearId) return;
    const list = await listClassRoomsAction(yearId);
    setClasses(list);
  }, [yearId]);

  useEffect(() => {
    void load();
  }, [load]);

  /* ────────── Tambah kelas ────────── */

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await createClassRoomAction({
      academicYearId: yearId,
      name: String(fd.get("name")),
    });
    if (res.ok) {
      toast("Kelas berhasil dibuat.", "success");
      router.refresh();
      await load();
      e.currentTarget.reset();
    } else {
      toast(res.message, "error");
    }
  }

  /* ────────── Edit kelas ────────── */

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editTarget) return;
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const res = await editClassRoomAction({
      classRoomId: editTarget.id,
      name: String(fd.get("name")),
    });
    setBusy(false);
    if (!res.ok) {
      toast(res.message, "error");
    } else {
      setEditTarget(null);
      toast("Nama kelas berhasil diperbarui.", "success");
      await load();
      router.refresh();
    }
  }

  /* ────────── Hapus kelas ────────── */

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    const res = await deleteClassRoomAction({ classRoomId: deleteTarget.id });
    setBusy(false);
    if (!res.ok) {
      toast(res.message, "error");
    } else {
      setDeleteTarget(null);
      toast("Kelas berhasil dihapus.", "success");
      await load();
      router.refresh();
    }
  }

  /* ────────── Set wali kelas ────────── */

  async function handleSetHomeroom(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!homeroomTarget) return;
    const fd = new FormData(e.currentTarget);
    const teacherId = String(fd.get("teacherId")) || null;
    setBusy(true);
    const res = await setHomeroomTeacherAction({
      classRoomId: homeroomTarget.id,
      teacherId,
    });
    setBusy(false);
    if (!res.ok) {
      toast(res.message, "error");
    } else {
      setHomeroomTarget(null);
      const teacherName = teacherId
        ? props.teachers.find((t) => t.id === teacherId)?.nama ?? "—"
        : "(tidak ada)";
      toast(`Wali kelas ${homeroomTarget.name} → ${teacherName}`, "success");
      await load();
      router.refresh();
    }
  }

  /* ────────── render ────────── */

  return (
    <div className="min-w-0 w-full space-y-8 overflow-x-hidden">
      <div className="max-w-2xl space-y-1">
        <h1 className="ui-page-title">Data kelas</h1>
        <p className="ui-muted text-pretty">
          Struktur kelas dibagi per tahun ajaran agar progres siswa lebih
          terkontrol.
        </p>
      </div>

      <section className="ui-card ui-card-tight flex flex-wrap items-end gap-3">
        <label className="ui-label min-w-[12rem] grow sm:max-w-xs">
          Tahun ajaran
          <select
            value={yearId}
            onChange={(e) => setYearId(e.target.value)}
            className="ui-select mt-1.5"
          >
            {props.years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="ui-card ui-card-tight space-y-4">
        <h2 className="ui-section-title">Buat nama kelas</h2>
        <form
          onSubmit={add}
          className="flex max-w-xl flex-col gap-3 sm:flex-row sm:items-center"
        >
          <input
            required
            name="name"
            placeholder="Misal IX A"
            className="ui-input grow"
          />
          <button
            type="submit"
            className="ui-btn ui-btn-primary whitespace-nowrap"
          >
            Tambah kelas
          </button>
        </form>
      </section>

      {/* ─── Daftar kelas ─── */}
      <section className="min-w-0 w-full overflow-hidden">
        <h2 className="ui-section-title mb-3">
          Daftar kelas ({classes.length})
        </h2>
        <p className="ui-muted mb-2 text-xs md:hidden">
          Geser tabel ke kanan/kiri untuk melihat semua kolom.
        </p>
        <div className="ui-table-shell min-w-0 w-full">
          <div className="w-full overflow-x-auto overscroll-x-contain">
            <table className="rekap-table w-full min-w-[40rem] text-sm">
              <thead>
                <tr>
                  <th className="text-left">#</th>
                  <th className="text-left">Nama Kelas</th>
                  <th className="text-left">Wali Kelas</th>
                  <th className="text-left">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c, i) => (
                  <tr key={c.id}>
                    <td className="text-left">{i + 1}</td>
                    <td className="text-left font-semibold">{c.name}</td>
                    <td className="text-left">
                      {c.homeroomTeacherName ? (
                        <span>{c.homeroomTeacherName}</span>
                      ) : (
                        <span className="text-slate-400">Belum dipilih</span>
                      )}
                    </td>
                    <td className="text-left">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => setHomeroomTarget(c)}
                          disabled={busy}
                          className="ui-btn ui-btn-ghost px-2 py-1 text-xs"
                        >
                          Wali Kelas
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditTarget(c)}
                          disabled={busy}
                          className="ui-btn ui-btn-ghost px-2 py-1 text-xs"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(c)}
                          disabled={busy}
                          className="ui-btn ui-btn-ghost px-2 py-1 text-xs text-red-600 dark:text-red-400"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {classes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      Belum ada kelas atau tahun ajaran kosong.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ═══ Modal: Pilih wali kelas ═══ */}
      {homeroomTarget ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4">
          <div className="ui-card w-full max-w-md">
            <h3 className="ui-section-title mb-4">
              Wali Kelas — {homeroomTarget.name}
            </h3>
            {props.teachers.length === 0 ? (
              <p className="ui-muted mb-4 text-sm">
                Belum ada guru terdaftar. Tambahkan guru terlebih dahulu di menu
                Data Guru.
              </p>
            ) : (
              <form onSubmit={handleSetHomeroom} className="space-y-4">
                <label className="ui-label">
                  Pilih guru
                  <select
                    name="teacherId"
                    defaultValue={homeroomTarget.homeroomTeacherId ?? ""}
                    className="ui-select mt-1.5"
                  >
                    <option value="">— Tidak ada wali kelas —</option>
                    {props.teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nama}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="ui-btn ui-btn-ghost"
                    onClick={() => setHomeroomTarget(null)}
                    disabled={busy}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="ui-btn ui-btn-primary"
                    disabled={busy}
                  >
                    {busy ? "Menyimpan..." : "Simpan"}
                  </button>
                </div>
              </form>
            )}
            {props.teachers.length === 0 && (
              <div className="flex justify-end">
                <button
                  type="button"
                  className="ui-btn ui-btn-ghost"
                  onClick={() => setHomeroomTarget(null)}
                >
                  Tutup
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* ═══ Modal: Edit kelas ═══ */}
      {editTarget ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4">
          <div className="ui-card w-full max-w-md">
            <h3 className="ui-section-title mb-4">Edit kelas</h3>
            <form onSubmit={handleEdit} className="space-y-3">
              <label className="ui-label">
                Nama kelas
                <input
                  name="name"
                  defaultValue={editTarget.name}
                  required
                  className="ui-input mt-1"
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="ui-btn ui-btn-ghost"
                  onClick={() => setEditTarget(null)}
                  disabled={busy}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="ui-btn ui-btn-primary"
                  disabled={busy}
                >
                  {busy ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* ═══ Modal: Konfirmasi hapus ═══ */}
      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="ui-card w-full max-w-sm text-center">
            <h3 className="ui-section-title mb-2">Hapus kelas?</h3>
            <p className="ui-muted mb-4 text-sm">
              Kelas <strong>{deleteTarget.name}</strong> akan dihapus. Siswa di
              kelas ini akan dilepas dari kelas (data siswa tetap ada).
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                className="ui-btn ui-btn-ghost"
                onClick={() => setDeleteTarget(null)}
                disabled={busy}
              >
                Batal
              </button>
              <button
                type="button"
                className="ui-btn bg-red-600 text-white hover:bg-red-700"
                onClick={handleDelete}
                disabled={busy}
              >
                {busy ? "Menghapus..." : "Ya, hapus"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
