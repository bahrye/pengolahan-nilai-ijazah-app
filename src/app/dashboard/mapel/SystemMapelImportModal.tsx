"use client";

import { useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/ToastProvider";
import { catalogSubjectKey } from "@/lib/subject-catalog";
import {
  defaultJenisUjianForJenjang,
  defaultJenisUjianLabel,
} from "@/lib/subject-jenis-ujian";

import type { SchoolLevel } from "@prisma/client";
import {
  getSubjectCatalogForSchoolAction,
  type SubjectCatalogPayload,
} from "@/server/actions/subject-catalog";
import {
  bulkCreateSubjectsAction,
  type SubjectRow,
} from "@/server/actions/subjects";

type Props = {
  open: boolean;
  schoolJenjang: SchoolLevel | null;
  onClose: () => void;
  onImported: (list: SubjectRow[]) => void;
};

export function SystemMapelImportModal({
  open,
  schoolJenjang,
  onClose,
  onImported,
}: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [catalog, setCatalog] = useState<SubjectCatalogPayload | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hideExisting, setHideExisting] = useState(true);
  const [filterKelompok, setFilterKelompok] = useState("");

  useEffect(() => {
    if (!open) {
      setCatalog(null);
      setSelected(new Set());
      setFilterKelompok("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    void getSubjectCatalogForSchoolAction().then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        toast(res.message, "error");
        onClose();
        return;
      }
      setCatalog(res.data);
      const existing = new Set(res.data.existingCodes);
      const initial = new Set(
        res.data.subjects
          .filter((s) => !existing.has(catalogSubjectKey(s.kode)))
          .map((s) => catalogSubjectKey(s.kode)),
      );
      setSelected(initial);
    });

    return () => {
      cancelled = true;
    };
  }, [open, onClose, toast]);

  const existingSet = useMemo(
    () => new Set(catalog?.existingCodes ?? []),
    [catalog?.existingCodes],
  );

  const kelompokOptions = useMemo(() => {
    if (!catalog) return [];
    const set = new Set(catalog.subjects.map((s) => s.kelompok));
    return Array.from(set).sort();
  }, [catalog]);

  const visibleSubjects = useMemo(() => {
    if (!catalog) return [];
    return catalog.subjects.filter((s) => {
      if (hideExisting && existingSet.has(catalogSubjectKey(s.kode))) {
        return false;
      }
      if (filterKelompok && s.kelompok !== filterKelompok) return false;
      return true;
    });
  }, [catalog, hideExisting, existingSet, filterKelompok]);

  const selectableKeys = useMemo(
    () =>
      visibleSubjects
        .filter((s) => !existingSet.has(catalogSubjectKey(s.kode)))
        .map((s) => catalogSubjectKey(s.kode)),
    [visibleSubjects, existingSet],
  );

  function toggleOne(kode: string) {
    const key = catalogSubjectKey(kode);
    if (existingSet.has(key)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const key of selectableKeys) next.add(key);
      return next;
    });
  }

  function clearVisibleSelection() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const key of selectableKeys) next.delete(key);
      return next;
    });
  }

  async function handleImport() {
    if (!catalog || selected.size === 0) {
      toast("Pilih minimal satu mapel untuk diimpor.", "error");
      return;
    }
    const items = catalog.subjects.filter((s) =>
      selected.has(catalogSubjectKey(s.kode)),
    );
    setImporting(true);
    const res = await bulkCreateSubjectsAction(
      items.map((s) => ({
        kode: s.kode,
        nama: s.nama,
        kelompok: s.kelompok,
        jenisUjian: defaultJenisUjianForJenjang(schoolJenjang),
      })),
    );
    setImporting(false);
    if (!res.ok) {
      toast(res.message, "error");
      return;
    }
    onImported(res.list);
    toast(
      `${items.length} mapel berhasil diimpor dari katalog sistem. Jenis ujian: ${defaultJenisUjianLabel(schoolJenjang)} — bisa diedit di daftar mapel.`,
      "success",
    );
    onClose();
  }

  if (!open) return null;

  return (
    <MapelImportModalShell onClose={onClose}>
      <h3 id="system-mapel-import-title" className="ui-section-title mb-1">
        Impor mapel (sistem)
      </h3>
      {loading && (
        <p className="ui-muted py-8 text-center text-sm">Memuat katalog mapel…</p>
      )}
      {!loading && catalog && (
        <>
          <p className="ui-muted mb-3 text-sm">
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {catalog.jenjangLabel}
            </span>
            {" · "}
            {catalog.trackLabel}
          </p>
          <p className="ui-muted mb-4 text-sm">{catalog.description}</p>

          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={hideExisting}
                onChange={(e) => setHideExisting(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              Sembunyikan yang sudah ada
            </label>
            <select
              value={filterKelompok}
              onChange={(e) => setFilterKelompok(e.target.value)}
              className="ui-input py-1.5 text-sm"
            >
              <option value="">Semua kelompok</option>
              {kelompokOptions.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={selectAllVisible}
              className="ui-btn ui-btn-ghost py-1.5 text-xs"
            >
              Pilih semua tampilan
            </button>
            <button
              type="button"
              onClick={clearVisibleSelection}
              className="ui-btn ui-btn-ghost py-1.5 text-xs"
            >
              Kosongkan pilihan
            </button>
            <span className="ui-muted ml-auto text-xs">
              {selected.size} dipilih · {visibleSubjects.length} ditampilkan
            </span>
          </div>

          <div className="mb-4 max-h-[50vh] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="rekap-table w-full text-sm">
              <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900">
                <tr>
                  <th className="w-10 px-2 py-2" />
                  <th className="px-3 py-2 text-left">Kode</th>
                  <th className="px-3 py-2 text-left">Nama</th>
                  <th className="px-3 py-2 text-left">Kelompok</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleSubjects.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="ui-muted px-3 py-6 text-center">
                      Tidak ada mapel untuk ditampilkan.
                    </td>
                  </tr>
                ) : (
                  visibleSubjects.map((s) => {
                    const key = catalogSubjectKey(s.kode);
                    const exists = existingSet.has(key);
                    const checked = exists || selected.has(key);
                    return (
                      <tr
                        key={key}
                        className={
                          exists
                            ? "bg-slate-50 opacity-70 dark:bg-slate-800/50"
                            : ""
                        }
                      >
                        <td className="px-2 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={exists}
                            onChange={() => toggleOne(s.kode)}
                            className="h-4 w-4 rounded border-slate-300"
                            aria-label={`Pilih ${s.nama}`}
                          />
                        </td>
                        <td className="px-3 py-1.5 font-mono text-xs">{s.kode}</td>
                        <td className="px-3 py-1.5">{s.nama}</td>
                        <td className="px-3 py-1.5">{s.kelompok}</td>
                        <td className="px-3 py-1.5 text-xs">
                          {exists ? (
                            <span className="text-amber-700 dark:text-amber-400">
                              Sudah ada
                            </span>
                          ) : (
                            <span className="text-emerald-700 dark:text-emerald-400">
                              Baru
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <p className="ui-muted mb-4 text-xs">
            Jenis ujian diimpor sebagai{" "}
            <strong>{defaultJenisUjianLabel(schoolJenjang)}</strong>.
            Ubah per mapel setelah impor lewat tombol Edit di daftar.
          </p>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={importing}
              className="ui-btn ui-btn-ghost"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => void handleImport()}
              disabled={importing || selected.size === 0}
              className="ui-btn ui-btn-success"
            >
              {importing
                ? "Mengimpor..."
                : `Impor ${selected.size} mapel terpilih`}
            </button>
          </div>
        </>
      )}
    </MapelImportModalShell>
  );
}

function MapelImportModalShell({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="ui-card w-full max-w-3xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="system-mapel-import-title"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
