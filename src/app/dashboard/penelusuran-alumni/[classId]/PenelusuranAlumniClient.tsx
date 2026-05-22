"use client";

import { Download, Search, ClipboardList } from "lucide-react";
import { useState } from "react";
import JSZip from "jszip";
import { generateTracerStudyPdf } from "@/lib/pdf/penelusuran-alumni-pdf";
import { generateRekapTracerStudyPdf } from "@/lib/pdf/rekap-penelusuran-alumni-pdf";
import { useToast } from "@/components/ToastProvider";

type StudentData = {
  id: string;
  name: string;
  nisn: string | null;
  nis: string | null;
  birthPlace: string | null;
  birthDate: Date | null;
};

export function PenelusuranAlumniClient({
  className,
  students,
  schoolName,
  jenjang,
  printLetterheadUrl,
}: {
  className: string;
  students: StudentData[];
  schoolName: string;
  jenjang: string | null;
  printLetterheadUrl: string | null;
}) {
  const [search, setSearch] = useState("");
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [isZipping, setIsZipping] = useState(false);
  const [isGeneratingRekap, setIsGeneratingRekap] = useState(false);
  const { toast, progressToast } = useToast();

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.nisn && s.nisn.includes(search)) ||
      (s.nis && s.nis.includes(search)),
  );

  async function handleDownload(student: StudentData) {
    const pt = progressToast({ total: 1, title: `Membuat formulir ${student.name}…` });
    try {
      setGeneratingFor(student.id);
      
      const doc = await generateTracerStudyPdf({
        student,
        schoolName,
        className,
        jenjang,
        printLetterheadUrl,
      });

      doc.save(`Formulir_Penelusuran_Alumni_${student.name.replace(/\s+/g, "_")}.pdf`);
      pt.success("Formulir berhasil diunduh.");
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      pt.error("Gagal membuat formulir.");
    } finally {
      setGeneratingFor(null);
    }
  }

  async function handleDownloadAll() {
    if (filteredStudents.length === 0) return;
    const pt = progressToast({
      total: filteredStudents.length + 1,
      title: "Membuat Formulir Tracer Study…",
    });
    
    try {
      setIsZipping(true);
      const zip = new JSZip();

      for (let i = 0; i < filteredStudents.length; i++) {
        const s = filteredStudents[i];
        pt.update(i + 1, `Memproses ${s.name} (${i + 1} / ${filteredStudents.length})`);
        
        const doc = await generateTracerStudyPdf({
          student: s,
          schoolName,
          className,
          jenjang,
          printLetterheadUrl,
        });
        const arrayBuffer = doc.output("arraybuffer");
        zip.file(
          `Formulir_Penelusuran_Alumni_${s.name.replace(/\s+/g, "_")}.pdf`,
          arrayBuffer
        );
      }
      
      pt.update(filteredStudents.length + 1, "Menyatukan file ZIP...");
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Formulir_Penelusuran_Alumni_Kelas_${className.replace(/\s+/g, "_")}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      
      pt.success(`Berhasil mengunduh ${filteredStudents.length} formulir.`);
    } catch (error) {
      console.error("Failed to generate ZIP:", error);
      pt.error("Gagal membuat ZIP formulir.");
    } finally {
      setIsZipping(false);
    }
  }

  async function handleDownloadRekap() {
    if (filteredStudents.length === 0) return;
    try {
      setIsGeneratingRekap(true);
      const doc = await generateRekapTracerStudyPdf({
        students: filteredStudents,
        schoolName,
        className,
        jenjang,
        printLetterheadUrl,
      });
      doc.save(`Rekap_Data_Alumni_Kelas_${className.replace(/\s+/g, "_")}.pdf`);
      toast("Daftar data alumni berhasil diunduh.", "success");
    } catch (error) {
      console.error("Failed to generate Rekap PDF:", error);
      toast("Gagal membuat PDF daftar alumni.", "error");
    } finally {
      setIsGeneratingRekap(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="max-w-3xl space-y-1">
        <h1 className="ui-page-title">Penelusuran Alumni: Kelas {className}</h1>
        <p className="ui-muted text-pretty">
          Unduh Formulir Penelusuran Alumni (Tracer Study) untuk masing-masing siswa.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative w-full max-w-sm sm:w-72">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="size-4 text-slate-400" />
            </div>
            <input
              type="text"
              className="ui-input w-full"
              style={{ paddingLeft: "2.25rem" }}
              placeholder="Cari nama atau NISN/NIS..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void handleDownloadRekap()}
              disabled={isGeneratingRekap || filteredStudents.length === 0}
              className="ui-btn ui-btn-outline ui-btn-sm inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              {isGeneratingRekap ? (
                <>
                  <div className="size-3.5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <ClipboardList className="size-3.5" aria-hidden />
                  <span>Data Alumni</span>
                </>
              )}
            </button>
            <button
              onClick={() => void handleDownloadAll()}
              disabled={isZipping || filteredStudents.length === 0 || generatingFor !== null}
              className="ui-btn ui-btn-primary ui-btn-sm inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              {isZipping ? (
                <>
                  <div className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Memproses {filteredStudents.length} PDF...</span>
                </>
              ) : (
                <>
                  <Download className="size-3.5" aria-hidden />
                  <span>Download Semua ({filteredStudents.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
        <div className="text-sm font-semibold text-slate-500">
          Total: {filteredStudents.length} Siswa
        </div>
      </div>

      <div className="ui-table-shell min-w-0 overflow-x-auto subtle-scrollbar">
        <table className="rekap-table w-full min-w-[48rem] text-sm">
          <thead>
            <tr>
              <th className="w-12 text-center">No</th>
              <th className="text-left">Nama Siswa</th>
              <th className="text-left">NISN / NIS</th>
              <th className="text-left">Tempat, Tgl Lahir</th>
              <th className="w-48 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  {search ? "Tidak ada siswa yang cocok dengan pencarian." : "Belum ada data siswa di kelas ini."}
                </td>
              </tr>
            ) : (
              filteredStudents.map((s, idx) => {
                const isGenerating = generatingFor === s.id;
                
                // Format birth date
                let ttl = "—";
                if (s.birthPlace || s.birthDate) {
                  const place = s.birthPlace || "";
                  const dateStr = s.birthDate 
                    ? new Intl.DateTimeFormat("id-ID", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      }).format(new Date(s.birthDate))
                    : "";
                  
                  if (place && dateStr) ttl = `${place}, ${dateStr}`;
                  else if (place) ttl = place;
                  else if (dateStr) ttl = dateStr;
                }

                return (
                  <tr key={s.id}>
                    <td className="text-center tabular-nums text-slate-500">{idx + 1}</td>
                    <td className="text-left font-medium text-slate-800 dark:text-slate-100">
                      {s.name}
                    </td>
                    <td className="text-left font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400">
                      <div>{s.nisn ?? "—"}</div>
                      {s.nis && <div className="text-[10px] text-slate-400 mt-0.5">NIS: {s.nis}</div>}
                    </td>
                    <td className="text-left text-slate-600 dark:text-slate-400">{ttl}</td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => void handleDownload(s)}
                        disabled={generatingFor !== null}
                        className="ui-btn ui-btn-outline ui-btn-sm inline-flex items-center gap-1.5"
                      >
                        {isGenerating ? (
                          <>
                            <div className="size-3.5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                            <span>Memproses...</span>
                          </>
                        ) : (
                          <>
                            <Download className="size-3.5" aria-hidden />
                            <span>Download Formulir</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
