"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Trophy, Medal, Award } from "lucide-react";

import { useToast } from "@/components/ToastProvider";
import { getPeringkatKelasAction, type PeringkatData } from "@/server/actions/peringkat";

export type CekPeringkatClientProps = {
  classRooms: { id: string; name: string }[];
  activeYearLabel: string;
};

type ScoreType = "ijazah" | "ujian" | "rapor";
type RankLimit = "5" | "15" | "all";

function HoverMarquee({ text }: { text: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        setIsOverflowing(textRef.current.scrollWidth > containerRef.current.clientWidth);
      }
    };
    checkOverflow();
    const timeout = setTimeout(checkOverflow, 100);
    window.addEventListener("resize", checkOverflow);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("resize", checkOverflow);
    };
  }, [text]);

  return (
    <>
      {/* Tampilan Ponsel: Scroll horizontal native agar bisa digeser dengan jari */}
      <div className="flex-grow min-w-0 overflow-x-auto sm:hidden pb-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <span className="text-sm font-semibold text-slate-900 dark:text-white whitespace-nowrap pr-4 block">
          {text}
        </span>
      </div>

      {/* Tampilan Desktop: Efek Marquee saat hover */}
      <div
        ref={containerRef}
        className="hidden sm:block relative flex-grow min-w-0 overflow-hidden pr-4"
      >
        <div className={`text-sm font-semibold text-slate-900 dark:text-white truncate transition-opacity ${
          isOverflowing ? 'group-hover:opacity-0' : ''
        }`}>
          <span ref={textRef}>{text}</span>
        </div>
        
        {isOverflowing && (
          <motion.div
            className="absolute top-0 left-0 hidden group-hover:flex whitespace-nowrap"
            animate={{ x: ["0%", "calc(-50% - 1rem)"] }}
            transition={{ repeat: Infinity, ease: "linear", duration: 4 }}
            style={{ gap: "2rem" }}
          >
            <span className="text-sm font-semibold text-slate-900 dark:text-white">{text}</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">{text}</span>
          </motion.div>
        )}
      </div>
    </>
  );
}

export function CekPeringkatClient({ classRooms, activeYearLabel }: CekPeringkatClientProps) {
  const { toast } = useToast();
  const [classRoomId, setClassRoomId] = useState("");
  const [scoreType, setScoreType] = useState<ScoreType>("ijazah");
  const [rankLimit, setRankLimit] = useState<RankLimit>("5");
  
  const [data, setData] = useState<PeringkatData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!classRoomId) {
      setData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    
    getPeringkatKelasAction(classRoomId).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        toast(res.message, "error");
        setData(null);
        return;
      }
      setData(res.data);
    }).catch((e) => {
      if (cancelled) return;
      setLoading(false);
      toast((e as Error).message, "error");
    });

    return () => {
      cancelled = true;
    };
  }, [classRoomId, toast]);

  const displayedData = useMemo(() => {
    if (!data) return [];
    const sourceData = data[scoreType] || [];
    
    let limit = sourceData.length;
    if (rankLimit === "5") limit = 5;
    else if (rankLimit === "15") limit = 15;
    
    return sourceData.slice(0, limit).map((item, index) => ({
      ...item,
      rank: index + 1
    }));
  }, [data, scoreType, rankLimit]);

  const maxScore = useMemo(() => {
    if (!data) return 100;
    const sourceData = data[scoreType] || [];
    if (sourceData.length === 0) return 100;
    return Math.max(100, sourceData[0].rataRata);
  }, [data, scoreType]);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-6 w-6 text-yellow-500 drop-shadow-md" />;
    if (rank === 2) return <Trophy className="h-5 w-5 text-slate-400 drop-shadow-md" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-600 drop-shadow-md" />;
    return <Award className="h-4 w-4 text-slate-300" />;
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return "from-yellow-400 to-amber-500 ring-yellow-500/50";
    if (rank === 2) return "from-slate-300 to-slate-400 ring-slate-400/50";
    if (rank === 3) return "from-amber-600 to-orange-700 ring-orange-700/50";
    return "from-blue-500 to-indigo-600 ring-indigo-500/50";
  };

  return (
    <div className="space-y-8">
      <div className="max-w-3xl space-y-1">
        <h1 className="ui-page-title">Cek Peringkat Siswa</h1>
        <p className="ui-muted text-pretty">
          Pilih kelas untuk melihat peringkat siswa secara instan berdasarkan perhitungan akhir rekapitulasi nilai.
          Jika ada nama siswa yang terlalu panjang, Anda dapat mengarahkan kursor (atau menggeser nama pada layar sentuh) untuk melihat nama lengkapnya.
        </p>
      </div>

      <section className="ui-card max-w-4xl space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Kelas</span>
            <select
              className="ui-input w-full"
              value={classRoomId}
              onChange={(e) => setClassRoomId(e.target.value)}
            >
              <option value="">— Pilih kelas —</option>
              {classRooms.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Jenis Nilai</span>
            <select
              className="ui-input w-full"
              value={scoreType}
              onChange={(e) => setScoreType(e.target.value as ScoreType)}
              disabled={!data && !loading}
            >
              <option value="ijazah">Nilai Ijazah (Gabungan)</option>
              <option value="ujian">Nilai Ujian</option>
              <option value="rapor">Nilai Rapor</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Tampilkan</span>
            <select
              className="ui-input w-full"
              value={rankLimit}
              onChange={(e) => setRankLimit(e.target.value as RankLimit)}
              disabled={!data && !loading}
            >
              <option value="5">Top 5</option>
              <option value="15">Top 15</option>
              <option value="all">Semua Siswa</option>
            </select>
          </label>
        </div>
      </section>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-indigo-600"></div>
        </div>
      ) : classRoomId && data ? (
        <section className="ui-card bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-xl border-white/20 dark:border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 dark:opacity-10 pointer-events-none">
            <Trophy className="w-64 h-64" />
          </div>
          
          <div className="mb-6 flex justify-between items-end relative z-10">
            <div>
              <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                Peringkat Kelas
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Tahun Ajaran {activeYearLabel}
              </p>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
                {scoreType === "ijazah" ? "Nilai Ijazah" : scoreType === "ujian" ? "Nilai Ujian" : "Nilai Rapor"}
              </span>
            </div>
          </div>

          <div className="space-y-4 relative z-10">
            {displayedData.length === 0 ? (
              <p className="text-center text-slate-500 py-8">Belum ada data nilai untuk kelas ini.</p>
            ) : (
              <AnimatePresence mode="popLayout">
                {displayedData.map((student) => {
                  const percentage = (student.rataRata / maxScore) * 100;
                  
                  return (
                    <motion.div
                      key={student.nisn}
                      layout
                      initial={{ opacity: 0, x: -20, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                      className="group relative flex items-center gap-4 bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-slate-100 dark:border-slate-700"
                    >
                      <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-full bg-slate-50 dark:bg-slate-900 font-bold text-slate-700 dark:text-slate-300">
                        {getRankIcon(student.rank)}
                        {student.rank > 3 && <span className="text-lg">{student.rank}</span>}
                      </div>
                      
                      <div className="flex-grow min-w-0">
                        <div className="flex justify-between items-baseline mb-1">
                          <HoverMarquee text={student.nama} />
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap pl-2">
                            {student.rataRata.toFixed(2)}
                          </span>
                        </div>
                        
                        <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 1, ease: "easeOut", delay: student.rank * 0.05 }}
                            className={`h-full rounded-full bg-gradient-to-r ${getRankColor(student.rank)} shadow-sm ring-1 ring-inset`}
                          />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
