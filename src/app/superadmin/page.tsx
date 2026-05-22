"use client";

import { useSession } from "next-auth/react";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { enterSuperadminSchoolAction } from "@/server/actions/superadmin-impersonation";
import {
  listSchoolsAction,
  setSchoolActiveFlagAction,
  type SuperadminSchoolListItem,
} from "@/server/actions/superadmin";

import { SchoolAdminAccountsModal } from "./SchoolAdminAccountsModal";
import { SuperadminSchoolsTable } from "./SuperadminSchoolsTable";
import { SuperadminSubscriptionPanel } from "./SuperadminSubscriptionPanel";
import { SuperadminMaintenancePanel } from "./SuperadminMaintenancePanel";
import { SuperadminSubscriptionTable } from "./SuperadminSubscriptionTable";

export default function SuperadminPage() {
  const { update } = useSession();
  const [activeSchools, setActiveSchools] = useState<SuperadminSchoolListItem[]>([]);
  const [inactiveSchools, setInactiveSchools] = useState<SuperadminSchoolListItem[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [enteringSchoolId, setEnteringSchoolId] = useState<string | null>(null);
  const [accountsSchool, setAccountsSchool] = useState<{
    id: string;
    namaSekolah: string | null;
  } | null>(null);

  const reload = useCallback(async () => {
    const [active, inactive] = await Promise.all([
      listSchoolsAction(true),
      listSchoolsAction(false),
    ]);
    setActiveSchools(active);
    setInactiveSchools(inactive);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onEnterSchool(schoolId: string) {
    setEnteringSchoolId(schoolId);
    setMsg(null);
    const r = await enterSuperadminSchoolAction({ schoolId });
    if (!r.ok) {
      setMsg(r.message);
      setEnteringSchoolId(null);
      return;
    }
    await update({ impersonatingSchoolId: schoolId });
    window.location.assign("/dashboard/peta-situs");
  }

  async function onToggleActive(schoolId: string, next: boolean) {
    setBusy(true);
    setMsg(null);
    const r = await setSchoolActiveFlagAction({ schoolId, isActive: next });
    setBusy(false);
    if (!r.ok) setMsg(r.message);
    else {
      setMsg(next ? "Sekolah diaktifkan kembali." : "Sekolah dinonaktifkan.");
      await reload();
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="ui-page-title">Pengelolaan global sekolah</h1>
        <p className="ui-muted mt-2 max-w-2xl">
          Verifikasi langganan, kelola riwayat pembayaran, dan aktifkan/nonaktifkan sekolah.
        </p>
      </div>
      {msg ? (
        <p role="status" className="ui-alert ui-alert-info font-medium">
          {msg}
        </p>
      ) : null}

      <section id="verifikasi-langganan" className="scroll-mt-24 ui-card ui-card-tight space-y-4">
        <h2 className="ui-section-title">Verifikasi langganan</h2>
        <SuperadminSubscriptionPanel />
      </section>

      <section id="tabel-langganan" className="scroll-mt-24 ui-card ui-card-tight space-y-4">
        <h2 className="ui-section-title">Tabel langganan</h2>
        <p className="ui-muted text-sm">
          Semua pengajuan pembayaran langganan. Preview bukti, hapus data (termasuk file di
          Cloudinary). Menghapus pembayaran yang disetujui juga membatalkan segmen langganan
          terkait.
        </p>
        <SuperadminSubscriptionTable />
      </section>

      <section id="sekolah-aktif" className="scroll-mt-24">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="ui-section-title">Daftar sekolah aktif</h2>
          <button
            type="button"
            disabled={refreshing || busy}
            onClick={async () => {
              setRefreshing(true);
              await reload();
              setRefreshing(false);
            }}
            className="ui-btn ui-btn-ghost ui-btn-sm inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
            {refreshing ? 'Memuat…' : 'Refresh'}
          </button>
        </div>
        <p className="ui-muted mb-3 text-sm">
          Diurutkan dari registrasi paling lama ke terbaru. Menampilkan 10 sekolah per halaman.
          Centang ujian/rapor jika sudah ada minimal satu nilai terisi.
        </p>
        <SuperadminSchoolsTable
          variant="active"
          emptyMessage="Tidak ada sekolah aktif."
          schools={activeSchools}
          busy={busy}
          enteringSchoolId={enteringSchoolId}
          onAccounts={(s) => setAccountsSchool({ id: s.id, namaSekolah: s.namaSekolah })}
          onEnter={(schoolId) => void onEnterSchool(schoolId)}
          onDeactivate={(schoolId) => void onToggleActive(schoolId, false)}
          paginated
        />
      </section>

      <section id="sekolah-nonaktif" className="scroll-mt-24">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="ui-section-title">Sekolah nonaktif</h2>
          <button
            type="button"
            disabled={refreshing || busy}
            onClick={async () => {
              setRefreshing(true);
              await reload();
              setRefreshing(false);
            }}
            className="ui-btn ui-btn-ghost ui-btn-sm inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
            {refreshing ? 'Memuat…' : 'Refresh'}
          </button>
        </div>
        <p className="ui-muted mb-3 text-sm">
          Akun admin, guru, dan siswa tidak dapat masuk selama sekolah dinonaktifkan.
        </p>
        <SuperadminSchoolsTable
          variant="inactive"
          emptyMessage="Tidak ada sekolah nonaktif."
          schools={inactiveSchools}
          busy={busy}
          enteringSchoolId={enteringSchoolId}
          onAccounts={(s) => setAccountsSchool({ id: s.id, namaSekolah: s.namaSekolah })}
          onActivate={(schoolId) => void onToggleActive(schoolId, true)}
          paginated
        />
      </section>

      {accountsSchool ? (
        <SchoolAdminAccountsModal
          schoolId={accountsSchool.id}
          schoolName={accountsSchool.namaSekolah ?? "Sekolah"}
          onClose={() => setAccountsSchool(null)}
        />
      ) : null}

      <section id="maintenance" className="scroll-mt-24">
        <SuperadminMaintenancePanel />
      </section>
    </div>
  );
}
