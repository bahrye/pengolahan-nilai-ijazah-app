import { prisma } from "@/lib/prisma";

/** Guru masih memakai PIN awal dari admin (belum mengganti sandi sendiri). */
export async function guruUserUsesDefaultLoginPin(userId: string): Promise<boolean> {
  const row = await prisma.teacher.findFirst({
    where: { userId, usesDefaultLoginPin: true },
    select: { id: true },
  });
  return row != null;
}

export const GURU_PIN_PASSWORD_RESET_MESSAGE =
  "Akun guru ini masih memakai PIN login dari Administrator Sekolah. Masuk dulu dengan PIN di halaman login, lalu ubah sandi lewat menu Ubah Password setelah masuk. Untuk mengetahui PIN, hubungi Administrator Sekolah Anda.";
