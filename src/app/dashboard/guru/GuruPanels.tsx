"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { useToast } from "@/components/ToastProvider";
import {
  createTeachingAssignmentAction,
  deleteTeachingAssignmentAction,
} from "@/server/actions/assignments";
import {
  editTeacherAction,
  ensureTeacherLoginCardAction,
  getTeacherLoginCardAction,
  removeTeacherFromNonSatminkalSchoolAction,
  resetTeacherPasswordAction,
  toggleTeacherActiveAction,
  upsertTeacherAction,
} from "@/server/actions/teachers";
import { buildTeacherImportTemplate, GuruImportModal } from "@/components/guru/GuruImportModal";
import { buildTeacherLoginCardsPdfBlob } from "@/lib/buildTeacherLoginCardsPdf";
import { buildTeacherLoginCardsTxtBlob } from "@/lib/buildTeacherLoginCardsTxt";

type TeacherPack = {
  id: string;
  nama: string;
  nip: string | null;
  isActive: boolean;
  /** False setelah guru mengganti sandi sendiri — kartu login PIN dinonaktifkan sampai admin reset. */
  usesDefaultLoginPin: boolean;
  /** `User.schoolId` — sekolah induk akun; jika sama dengan tenant, guru melekat di sekolah ini. */
  user: { email: string | null; schoolId: string | null };
  assignments: {
    id: string;
    subject: { code: string; name: string };
    classRoom: { name: string };
  }[];
};

/** Guru induk di tenant ini: akun utama (`User.schoolId`) sama dengan sekolah yang sedang dibuka. */
function isGuruIndukDiSekolah(t: TeacherPack, tenantSchoolId: string): boolean {
  return t.user.schoolId != null && t.user.schoolId === tenantSchoolId;
}

function getLoginPageUrl(): string {
  if (typeof window === "undefined") return "/login";
  return new URL("/login", window.location.origin).href;
}

export function GuruPanels(props: {
  tenantSchoolId: string;
  teachers: TeacherPack[];
  subjects: { id: string; code: string; name: string }[];
  classRooms: { id: string; name: string }[];
  yearLabel: string;
  schoolName?: string;
  /** Satminkal: tambah guru, impor, reset sandi, kartu login, edit. Non-satminkal: penugasan, nonaktifkan, hapus dari sekolah ini. */
  canManageCredentials: boolean;
}) {
  const router = useRouter();
  const { toast, progressToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [bulkLoginBusy, setBulkLoginBusy] = useState(false);

  const [loginCard, setLoginCard] = useState<{
    nama: string;
    email: string;
    password: string;
  } | null>(null);

  const [editTarget, setEditTarget] = useState<TeacherPack | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    variant: "danger" | "warning";
    onConfirm: () => Promise<void>;
  } | null>(null);

  const [bulkLoginModalOpen, setBulkLoginModalOpen] = useState(false);
  const [bulkExportFormat, setBulkExportFormat] = useState<"pdf" | "txt">("pdf");

  const teachersInduk = useMemo(
    () => props.teachers.filter((t) => isGuruIndukDiSekolah(t, props.tenantSchoolId)),
    [props.teachers, props.tenantSchoolId],
  );

  const teachersIndukKartuPin = useMemo(
    () => teachersInduk.filter((t) => t.usesDefaultLoginPin),
    [teachersInduk],
  );

  /* ────────── Edit guru ────────── */

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editTarget) return;
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const r = await editTeacherAction({
      teacherId: editTarget.id,
      nama: String(fd.get("nama")),
      nip: String(fd.get("nip") || "") || null,
      email: String(fd.get("email")),
    });
    setBusy(false);
    if (r.ok) {
      toast("Data guru berhasil diperbarui.", "success");
      setEditTarget(null);
      router.refresh();
    } else {
      toast(r.message, "error");
    }
  }

  /* ────────── Nonaktifkan / aktifkan guru ────────── */

  function handleToggleActive(t: TeacherPack) {
    const isDeactivate = t.isActive;
    setConfirmModal({
      title: isDeactivate ? "Nonaktifkan Guru" : "Aktifkan Guru",
      message: isDeactivate
        ? `Yakin ingin menonaktifkan ${t.nama}? Guru tidak akan bisa login setelah dinonaktifkan.`
        : `Yakin ingin mengaktifkan kembali ${t.nama}?`,
      confirmLabel: isDeactivate ? "Nonaktifkan" : "Aktifkan",
      variant: isDeactivate ? "danger" : "warning",
      onConfirm: async () => {
        setBusy(true);
        const r = await toggleTeacherActiveAction({ teacherId: t.id });
        setBusy(false);
        setConfirmModal(null);
        if (r.ok) {
          toast(
            r.isActive
              ? `${t.nama} berhasil diaktifkan.`
              : `${t.nama} berhasil dinonaktifkan.`,
            "success",
          );
          router.refresh();
        } else {
          toast(r.message, "error");
        }
      },
    });
  }

  /* ────────── Tambah guru ────────── */

  async function onTeacher(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setBusy(true);
    const r = await upsertTeacherAction({
      email: String(fd.get("email")),
      nama: String(fd.get("nama")),
      nip: String(fd.get("nip") || "") || null,
    });
    setBusy(false);
    if (r.ok) {
      toast("Guru berhasil ditambahkan / diperbarui.", "success");
      form.reset();
      router.refresh();
    } else {
      toast(r.message, "error");
    }
  }

  /* ────────── Penugasan ────────── */

  async function onAssign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const r = await createTeachingAssignmentAction({
      teacherId: String(fd.get("teacherId")),
      subjectId: String(fd.get("subjectId")),
      classRoomId: String(fd.get("classRoomId")),
    });
    setBusy(false);
    if (r.ok) {
      toast("Penugasan berhasil dibuat.", "success");
      router.refresh();
    } else {
      toast(r.message, "error");
    }
  }

  /* ────────── Buat Kartu Login (baca password, tidak reset) ────────── */

  async function handleShowLoginCard(t: TeacherPack) {
    setBusy(true);
    const res = await getTeacherLoginCardAction({ teacherId: t.id });
    setBusy(false);
    if (!res.ok) {
      toast(res.message, "error");
    } else {
      setLoginCard({
        nama: res.nama,
        email: res.email,
        password: res.password,
      });
    }
  }

  /* ────────── Reset Password ────────── */

  function handleResetPassword(t: TeacherPack) {
    setConfirmModal({
      title: "Reset Password",
      message: `Yakin ingin reset password ${t.nama}? Sandi lama diganti PIN 8 digit baru. Guru bisa login dengan PIN ini dan kartu login (PIN) aktif kembali.`,
      confirmLabel: "Reset Password",
      variant: "warning",
      onConfirm: async () => {
        setBusy(true);
        const res = await resetTeacherPasswordAction({ teacherId: t.id });
        setBusy(false);
        setConfirmModal(null);
        if (!res.ok) {
          toast(res.message, "error");
        } else {
          setLoginCard({
            nama: res.nama,
            email: res.email,
            password: res.newPassword,
          });
          toast(`Password ${t.nama} berhasil direset.`, "success");
        }
      },
    });
  }

  /* ────────── Copy & Share helpers ────────── */

  function cardText() {
    if (!loginCard) return "";
    const loginUrl = getLoginPageUrl();
    return `Kartu Login Guru\n${props.schoolName ? `Sekolah: ${props.schoolName}\n` : ""}Nama: ${loginCard.nama}\nEmail: ${loginCard.email}\nPassword: ${loginCard.password}\nLink login: ${loginUrl}`;
  }

  function handleCopyCard() {
    navigator.clipboard.writeText(cardText());
    toast("Kartu login disalin ke clipboard.", "success");
  }

  function handleShareWhatsApp() {
    const text = encodeURIComponent(cardText());
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  async function runBulkLoginCards(format: "pdf" | "txt") {
    const teachers = teachersInduk;
    const pt = progressToast({
      total: teachers.length,
      title: "Generate kartu login…",
    });
    setBulkLoginBusy(true);
    const cards: {
      nama: string;
      email: string;
      password: string;
      wasReset: boolean;
    }[] = [];
    const exportedAtLabel = new Date().toLocaleString("id-ID", {
      dateStyle: "long",
      timeStyle: "short",
    });

    const errors: string[] = [];
    try {
      for (let i = 0; i < teachers.length; i++) {
        const t = teachers[i];
        if (!t.usesDefaultLoginPin) {
          errors.push(
            `${t.nama}: sudah mengubah sandi sendiri — kartu login (PIN) dinonaktifkan. Reset sandi diperlukan untuk PIN baru.`,
          );
          pt.update(i + 1);
          continue;
        }
        pt.update(i, `Memproses: ${t.nama} (${i + 1}/${teachers.length})`);
        const res = await ensureTeacherLoginCardAction({ teacherId: t.id });
        if (!res.ok) {
          errors.push(`${t.nama}: ${res.message}`);
          pt.update(i + 1);
          continue;
        }
        cards.push({
          nama: t.nama,
          email: res.email,
          password: res.password,
          wasReset: res.wasReset,
        });
        pt.update(i + 1);
      }

      const base = `kartu-login-guru-${new Date().toISOString().slice(0, 10)}`;
      const loginUrl = getLoginPageUrl();
      const blob =
        format === "pdf"
          ? buildTeacherLoginCardsPdfBlob({
              schoolName: props.schoolName,
              exportedAtLabel,
              loginUrl,
              cards,
              errors,
            })
          : buildTeacherLoginCardsTxtBlob({
              schoolName: props.schoolName,
              exportedAtLabel,
              loginUrl,
              cards,
              errors,
            });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = format === "pdf" ? `${base}.pdf` : `${base}.txt`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      const okCount = teachers.length - errors.length;
      const fmtLabel = format === "pdf" ? "PDF" : "TXT";
      const msg =
        errors.length === 0
          ? `Semua ${okCount} kartu login berhasil dimuat & ${fmtLabel} disimpan (folder unduhan).`
          : `${okCount} berhasil, ${errors.length} gagal — rincian ada di akhir file ${fmtLabel}.`;
      pt.success(msg);
      router.refresh();
    } catch (e) {
      pt.error(
        (e as Error).message ??
          (format === "pdf" ? "Gagal membuat PDF kartu login." : "Gagal membuat file TXT kartu login."),
      );
    } finally {
      setBulkLoginBusy(false);
    }
  }

  function handleBulkLoginCardsClick() {
    if (teachersInduk.length === 0) {
      toast("Tidak ada guru induk (badge Satminkal) yang bisa diekspor kartu loginnya.", "warning");
      return;
    }
    if (teachersIndukKartuPin.length === 0) {
      toast(
        "Semua guru induk sudah mengubah sandi sendiri — generate kartu login (PIN) tidak tersedia. Reset sandi per guru bila perlu PIN baru.",
        "warning",
      );
      return;
    }
    setBulkExportFormat("pdf");
    setBulkLoginModalOpen(true);
  }

  /* ────────── render ────────── */

  return (
    <div className="min-w-0 w-full space-y-8 overflow-x-hidden">
      <div className="max-w-2xl space-y-1">
        <h1 className="ui-page-title">Guru &amp; penugasan</h1>
        <p className="ui-muted text-pretty">
          Kelola guru beserta kombinasi mata pelajaran dan kelas secara
          transparan.
        </p>
      </div>

      {/* ─── Tambah / perbarui guru (satminkal) ─── */}
      {props.canManageCredentials ? (
        <section className="ui-card ui-card-tight space-y-4">
          <h2 className="ui-section-title">Tambah / perbarui guru</h2>
          <p className="ui-muted text-sm">
            Masukkan email guru. Akun akan otomatis dibuat jika belum terdaftar
            dengan password 8 digit acak.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || props.subjects.length === 0}
              onClick={async () => {
                try {
                  const blob = await buildTeacherImportTemplate(
                    props.subjects.map((s) => ({ id: s.id, kode: s.code, nama: s.name })),
                    props.classRooms,
                    props.yearLabel,
                  );
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "template-import-guru.xlsx";
                  a.click();
                  URL.revokeObjectURL(url);
                  toast("Template berhasil diunduh.", "success");
                } catch (e) {
                  toast((e as Error).message ?? "Gagal membuat template.", "error");
                }
              }}
              className="ui-btn ui-btn-primary"
              title={props.subjects.length === 0 ? "Tambah mapel terlebih dahulu" : undefined}
            >
              Download template Excel
            </button>
            <button
              type="button"
              disabled={busy || bulkLoginBusy}
              onClick={() => setShowImportModal(true)}
              className="ui-btn ui-btn-primary"
            >
              Import guru Excel
            </button>
          </div>
          <form onSubmit={onTeacher} className="grid gap-3 md:grid-cols-3">
            <input
              required
              name="email"
              type="email"
              placeholder="Email guru *"
              className="ui-input"
            />
            <input
              required
              name="nama"
              placeholder="Nama lengkap *"
              className="ui-input"
            />
            <input name="nip" placeholder="NIP (opsional)" className="ui-input" />
            <button
              type="submit"
              disabled={busy || bulkLoginBusy}
              className="ui-btn ui-btn-success md:col-span-3 lg:col-span-1 lg:justify-self-start"
            >
              Simpan
            </button>
          </form>
        </section>
      ) : (
        <section className="ui-card ui-card-tight border-indigo-200/80 bg-indigo-50/50 dark:border-indigo-900/50 dark:bg-indigo-950/40">
          <h2 className="ui-section-title">Sekolah non-satminkal</h2>
          <p className="ui-muted text-sm text-pretty">
            Menambah guru lewat email, impor Excel, reset sandi, dan kartu login hanya di sekolah{" "}
            <strong>satminkal</strong>. Untuk guru dari satminkal lain, gunakan{" "}
            <Link href="/dashboard/tugas-tambahan-guru" className="font-semibold text-indigo-700 underline dark:text-indigo-300">
              Tugas tambahan guru
            </Link>
            .
          </p>
        </section>
      )}

      {/* ─── Penugasan mapel ↔ kelas ─── */}
      <section className="ui-card ui-card-tight space-y-4">
        <h2 className="ui-section-title">Penugasan mapel ↔ kelas</h2>
        <p className="ui-muted text-sm">
          Guru hanya bisa input nilai ujian pada mapel dan kelas yang ditugaskan.
        </p>
        <form onSubmit={onAssign} className="grid gap-3 md:grid-cols-3">
          <select name="teacherId" required className="ui-select">
            <option value="">Guru...</option>
            {props.teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nama}
              </option>
            ))}
          </select>
          <select name="subjectId" required className="ui-select">
            <option value="">Mapel...</option>
            {props.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
          <select name="classRoomId" required className="ui-select">
            <option value="">Kelas...</option>
            {props.classRooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={busy || bulkLoginBusy}
            className="ui-btn ui-btn-primary md:col-span-3 lg:col-span-1 lg:justify-self-start"
          >
            Tambahkan penugasan
          </button>
        </form>
      </section>

      {/* ─── Daftar guru ─── */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="ui-section-title">Daftar guru ({props.teachers.length})</h2>
          {props.canManageCredentials ? (
            <button
              type="button"
              disabled={busy || bulkLoginBusy || teachersIndukKartuPin.length === 0}
              onClick={handleBulkLoginCardsClick}
              title={
                teachersInduk.length === 0
                  ? "Hanya guru induk (badge Satminkal) yang bisa kartu login / reset PIN massal"
                  : teachersIndukKartuPin.length === 0
                    ? "Semua guru induk sudah mengubah sandi sendiri — generate kartu PIN tidak tersedia (reset sandi per guru bila perlu)."
                    : undefined
              }
              className="ui-btn ui-btn-ghost shrink-0 self-start sm:self-auto"
            >
              {bulkLoginBusy ? "Memproses…" : "Generate Kartu Login"}
            </button>
          ) : null}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {props.teachers.map((t) => {
            const induk = isGuruIndukDiSekolah(t, props.tenantSchoolId);
            const canCredentialOps = props.canManageCredentials && induk;
            return (
            <div
              key={t.id}
              className={`rounded-2xl border p-4 shadow-sm ${t.isActive ? "border-slate-200/80 bg-white/80 dark:border-slate-700/75 dark:bg-slate-800/90" : "border-rose-200/80 bg-rose-50/60 opacity-70 dark:border-rose-900/50 dark:bg-rose-950/80"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-700/80">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
                      {t.nama}
                    </p>
                    {induk ? (
                      <span
                        className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-900 ring-1 ring-emerald-200/90 dark:bg-emerald-900/45 dark:text-emerald-100 dark:ring-emerald-700/60"
                        title="Guru induk — sekolah ini adalah sekolah utama akun guru"
                      >
                        Satminkal
                      </span>
                    ) : (
                      <span
                        className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-950 ring-1 ring-orange-200/90 dark:bg-orange-950/55 dark:text-orange-100 dark:ring-orange-800/50"
                        title="Pengajar tambahan — akun utama guru di sekolah lain"
                      >
                        Non-Satminkal
                      </span>
                    )}
                    {!t.isActive && (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
                        Nonaktif
                      </span>
                    )}
                  </div>
                  <p className="ui-muted mt-1 text-[13px]">{t.user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {t.nip ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                      NIP {t.nip}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* penugasan */}
              <ul className="mt-3 space-y-2 text-[13px]">
                {t.assignments.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-indigo-50/80 px-3 py-2 dark:bg-white/5"
                  >
                    <span className="font-semibold text-slate-700 dark:text-slate-100">
                      {a.subject.code} — {a.classRoom.name}
                    </span>
                    <button
                      type="button"
                      disabled={busy || bulkLoginBusy}
                      className="ui-btn ui-btn-ghost ui-btn-sm !text-rose-600 hover:!bg-rose-50 dark:!text-rose-300 dark:hover:!bg-rose-950/40"
                      onClick={async () => {
                        await deleteTeachingAssignmentAction(a.id);
                        toast("Penugasan dihapus.", "success");
                        router.refresh();
                      }}
                    >
                      Hapus
                    </button>
                  </li>
                ))}
                {t.assignments.length === 0 ? (
                  <li className="ui-muted">Belum ada penugasan mapel.</li>
                ) : null}
              </ul>

              {/* tombol aksi */}
              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-700/80">
                {canCredentialOps ? (
                  <>
                    <button
                      type="button"
                      disabled={busy || bulkLoginBusy || !t.usesDefaultLoginPin}
                      title={
                        !t.usesDefaultLoginPin
                          ? "Guru sudah mengubah sandi sendiri — cetak kartu login (PIN) dinonaktifkan. Gunakan Reset sandi untuk PIN baru."
                          : undefined
                      }
                      onClick={() => handleShowLoginCard(t)}
                      className="ui-btn ui-btn-primary ui-btn-sm"
                    >
                      Kartu Login
                    </button>
                    <button
                      type="button"
                      disabled={busy || bulkLoginBusy}
                      onClick={() => handleResetPassword(t)}
                      className="ui-btn ui-btn-ghost ui-btn-sm"
                    >
                      Reset Password
                    </button>
                    <button
                      type="button"
                      disabled={busy || bulkLoginBusy}
                      onClick={() => setEditTarget(t)}
                      className="ui-btn ui-btn-ghost ui-btn-sm"
                    >
                      Edit
                    </button>
                  </>
                ) : null}
                {!induk ? (
                  <button
                    type="button"
                    disabled={busy || bulkLoginBusy}
                    onClick={() =>
                      setConfirmModal({
                        title: "Batal Non-Satminkal",
                        message: `Batalkan ${t.nama} sebagai guru non-satminkal di sekolah ini? Penugasan mapel di sekolah ini akan dihapus. Akun login di sekolah induk guru tidak dihapus.`,
                        confirmLabel: "Batal Non-Satminkal",
                        variant: "danger",
                        onConfirm: async () => {
                          setBusy(true);
                          const r = await removeTeacherFromNonSatminkalSchoolAction({
                            teacherId: t.id,
                          });
                          setBusy(false);
                          setConfirmModal(null);
                          if (!r.ok) {
                            toast(r.message, "error");
                          } else {
                            toast("Penugasan non-satminkal dibatalkan.", "success");
                            router.refresh();
                          }
                        },
                      })
                    }
                    className="ui-btn ui-btn-ghost ui-btn-sm !text-amber-800 hover:!bg-amber-50 dark:!text-amber-200 dark:hover:!bg-amber-950/45"
                  >
                    Batal Non-Satminkal
                  </button>
                ) : null}
                {induk ? (
                  <button
                    type="button"
                    disabled={busy || bulkLoginBusy}
                    onClick={() => handleToggleActive(t)}
                    className={`ui-btn ui-btn-ghost ui-btn-sm ${t.isActive ? "!text-rose-600 dark:!text-rose-400" : "!text-emerald-600 dark:!text-emerald-400"}`}
                  >
                    {t.isActive ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                ) : null}
              </div>
            </div>
            );
          })}
          {props.teachers.length === 0 ? (
            <p className="ui-muted lg:col-span-2">Belum ada data guru.</p>
          ) : null}
        </div>
      </section>

      {/* ═══ Modal: Konfirmasi ═══ */}
      {confirmModal ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md animate-[fadeScaleIn_0.2s_ease-out] rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  confirmModal.variant === "danger"
                    ? "bg-rose-100 text-rose-600 dark:bg-rose-900/80 dark:text-rose-400"
                    : "bg-amber-100 text-amber-600 dark:bg-amber-900/80 dark:text-amber-400"
                }`}
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {confirmModal.title}
              </h3>
            </div>
            <p className="mb-6 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {confirmModal.message}
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="ui-btn ui-btn-ghost"
                onClick={() => setConfirmModal(null)}
                disabled={busy || bulkLoginBusy}
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busy || bulkLoginBusy}
                className={`ui-btn ${
                  confirmModal.variant === "danger"
                    ? "bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-600"
                    : "bg-amber-500 text-white hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500"
                }`}
                onClick={confirmModal.onConfirm}
              >
                {busy || bulkLoginBusy ? "Memproses..." : confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ═══ Modal: Pilih format generate kartu login ═══ */}
      {bulkLoginModalOpen ? (
        <div className="fixed inset-0 z-[61] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-login-title"
            className="w-full max-w-md animate-[fadeScaleIn_0.2s_ease-out] rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <h3
              id="bulk-login-title"
              className="text-lg font-bold text-slate-900 dark:text-white"
            >
              Generate kartu login
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Sistem akan memproses <strong>{teachersInduk.length}</strong> guru induk (badge Satminkal) satu per satu.
              File berisi email dan password kartu login akan langsung diunduh (biasanya ke folder Unduhan). Guru yang
              belum punya PIN tersimpan akan otomatis mendapat PIN baru (setara reset password). Guru yang sudah
              mengubah sandi lewat menu Ubah Password dilewati (muncul sebagai catatan di akhir file) — gunakan Reset
              sandi untuk mengaktifkan kembali kartu PIN. Guru pengajar tambahan (badge Non-Satminkal) tidak disertakan.
            </p>

            <fieldset className="mt-5 space-y-2">
              <legend className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-100">
                Format unduhan
              </legend>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                  bulkExportFormat === "pdf"
                    ? "border-indigo-500 bg-indigo-50/90 dark:border-indigo-400 dark:bg-indigo-950/50"
                    : "border-slate-200 hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-500"
                }`}
              >
                <input
                  type="radio"
                  name="bulk-login-format"
                  className="mt-1 accent-indigo-600"
                  checked={bulkExportFormat === "pdf"}
                  onChange={() => setBulkExportFormat("pdf")}
                />
                <span>
                  <span className="font-semibold text-slate-900 dark:text-white">PDF</span>
                  <span className="mt-0.5 block text-xs leading-snug text-slate-600 dark:text-slate-400">
                    Disarankan: tata letak rapi, mudah dicetak atau dibagikan.
                  </span>
                </span>
              </label>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                  bulkExportFormat === "txt"
                    ? "border-indigo-500 bg-indigo-50/90 dark:border-indigo-400 dark:bg-indigo-950/50"
                    : "border-slate-200 hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-500"
                }`}
              >
                <input
                  type="radio"
                  name="bulk-login-format"
                  className="mt-1 accent-indigo-600"
                  checked={bulkExportFormat === "txt"}
                  onChange={() => setBulkExportFormat("txt")}
                />
                <span>
                  <span className="font-semibold text-slate-900 dark:text-white">TXT</span>
                  <span className="mt-0.5 block text-xs leading-snug text-slate-600 dark:text-slate-400">
                    Teks biasa, ringan, mudah diedit atau digabung ke dokumen lain.
                  </span>
                </span>
              </label>
            </fieldset>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="ui-btn ui-btn-ghost"
                onClick={() => setBulkLoginModalOpen(false)}
                disabled={bulkLoginBusy}
              >
                Batal
              </button>
              <button
                type="button"
                className="ui-btn ui-btn-primary"
                disabled={bulkLoginBusy}
                onClick={() => {
                  const fmt = bulkExportFormat;
                  setBulkLoginModalOpen(false);
                  void runBulkLoginCards(fmt);
                }}
              >
                Generate & unduh
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ═══ Modal: Edit Guru ═══ */}
      {editTarget &&
      props.canManageCredentials &&
      isGuruIndukDiSekolah(editTarget, props.tenantSchoolId) ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="ui-card w-full max-w-sm">
            <h3 className="ui-section-title mb-4">Edit Guru</h3>
            <form onSubmit={handleEdit} className="space-y-3">
              <input
                required
                name="nama"
                defaultValue={editTarget.nama}
                placeholder="Nama lengkap"
                className="ui-input w-full"
              />
              <input
                required
                name="email"
                type="email"
                defaultValue={editTarget.user.email ?? ""}
                placeholder="Email"
                className="ui-input w-full"
              />
              <input
                name="nip"
                defaultValue={editTarget.nip ?? ""}
                placeholder="NIP (opsional)"
                className="ui-input w-full"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="ui-btn ui-btn-ghost"
                  onClick={() => setEditTarget(null)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={busy || bulkLoginBusy}
                  className="ui-btn ui-btn-primary"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* ═══ Modal: Kartu Login Guru ═══ */}
      {loginCard ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="ui-card w-full max-w-sm">
            <h3 className="ui-section-title mb-4">Kartu Login Guru</h3>
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
              {props.schoolName ? (
                <p>
                  <strong>Sekolah</strong>: {props.schoolName}
                </p>
              ) : null}
              <p>
                <strong>Nama</strong>: {loginCard.nama}
              </p>
              <p>
                <strong>Email</strong>: {loginCard.email}
              </p>
              <p>
                <strong>Password</strong>:{" "}
                <code className="rounded bg-indigo-100 px-2 py-0.5 font-mono text-base font-bold text-indigo-800 dark:bg-indigo-900/80 dark:text-indigo-200">
                  {loginCard.password}
                </code>
              </p>
              <p className="break-all pt-0.5 text-[13px] leading-snug">
                <strong>Link login</strong>:{" "}
                <a
                  href={getLoginPageUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-indigo-600 underline decoration-indigo-400 underline-offset-2 hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-200"
                >
                  {getLoginPageUrl()}
                </a>
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="ui-btn ui-btn-primary ui-btn-sm"
                onClick={handleCopyCard}
              >
                Salin Teks
              </button>
              <button
                type="button"
                className="ui-btn ui-btn-sm bg-green-600 text-white hover:bg-green-700"
                onClick={handleShareWhatsApp}
              >
                Share WhatsApp
              </button>
              <button
                type="button"
                className="ui-btn ui-btn-ghost ui-btn-sm ml-auto"
                onClick={() => setLoginCard(null)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showImportModal ? (
        <GuruImportModal onClose={() => setShowImportModal(false)} onImported={() => router.refresh()} />
      ) : null}
    </div>
  );
}
