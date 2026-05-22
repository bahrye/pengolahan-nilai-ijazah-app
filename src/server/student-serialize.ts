import type { ClassRoom, Student } from "@prisma/client";

export type StudentRow = {
  id: string;
  nisn: string;
  name: string;
  gender: string | null;
  birthPlace: string | null;
  birthDate: string;
  className: string | null;
  classRoomId: string | null;
  classRoomName: string | null;
  isActive: boolean;
  /** Siswa punya baris User terhubung (akun login NISN + tgl lahir). */
  hasLogin: boolean;
  /** `User.isActive` — boleh login jika true dan password ada (diperiksa di auth). */
  loginActive: boolean;
};

type StudentWithClassRoom = Student & {
  classRoom?: ClassRoom | null;
  user?: { isActive: boolean } | null;
};

export function studentsToRows(students: StudentWithClassRoom[]): StudentRow[] {
  return students.map((s) => ({
    id: s.id,
    nisn: String(s.nisn),
    name: s.name,
    gender: s.gender,
    birthPlace: s.birthPlace,
    birthDate: s.birthDate ? s.birthDate.toISOString().slice(0, 10) : "",
    className: s.className,
    classRoomId: s.classRoomId,
    classRoomName: s.classRoom?.name ?? null,
    isActive: s.isActive,
    hasLogin: Boolean(s.userId),
    loginActive: Boolean(s.user?.isActive),
  }));
}
