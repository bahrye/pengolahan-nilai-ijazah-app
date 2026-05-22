import type { ExamInputPolicy } from "@prisma/client";

export type TeacherExamInputBanner =
  | { kind: "policy_locked" }
  | { kind: "before_window"; opensAtIso: string; closesAtIso: string }
  | { kind: "in_window"; closesAtIso: string }
  | { kind: "after_window" };

/** Untuk guru: apakah input/simpan/kirim ujian diblokir, dan pesan banner (jika ada). Admin tidak dibatasi. */
export function resolveTeacherExamInputGate(params: {
  policy: ExamInputPolicy;
  windowStart: Date | null;
  windowEnd: Date | null;
  now: Date;
  restrictAsTeacher: boolean;
}): { locked: boolean; banner: TeacherExamInputBanner | null } {
  if (!params.restrictAsTeacher) {
    return { locked: false, banner: null };
  }
  if (params.policy === "OPEN") {
    return { locked: false, banner: null };
  }
  if (params.policy === "LOCKED") {
    return { locked: true, banner: { kind: "policy_locked" } };
  }
  const s = params.windowStart;
  const e = params.windowEnd;
  if (!s || !e || s.getTime() >= e.getTime()) {
    return { locked: true, banner: { kind: "policy_locked" } };
  }
  const t = params.now.getTime();
  if (t < s.getTime()) {
    return {
      locked: true,
      banner: { kind: "before_window", opensAtIso: s.toISOString(), closesAtIso: e.toISOString() },
    };
  }
  if (t > e.getTime()) {
    return { locked: true, banner: { kind: "after_window" } };
  }
  return { locked: false, banner: { kind: "in_window", closesAtIso: e.toISOString() } };
}
