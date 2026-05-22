import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import {
  clearStudentCredentialLoginFailures,
  enforceStudentLoginRateLimit,
  recordStudentCredentialLoginFailure,
} from "@/lib/login-rate-limit";
import { prisma } from "@/lib/prisma";
import { studentLoginEmail } from "@/lib/student-login";
import { assertSchoolLoginAllowed } from "@/server/subscription-access";

type Body = { nisn?: unknown; tanggalLahir?: unknown };

/**
 * Pratinjau login siswa: validasi kredensial + langganan sekolah sebelum `signIn`.
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, message: "Format tidak valid." }, { status: 400 });
  }

  const nisnRaw = typeof body.nisn === "string" ? body.nisn : "";
  const tanggalLahir =
    typeof body.tanggalLahir === "string" ? body.tanggalLahir.trim() : "";
  const nisn = nisnRaw.replace(/\D/g, "").slice(0, 10);
  if (nisn.length !== 10 || !/^\d{2}-\d{2}-\d{4}$/.test(tanggalLahir)) {
    return NextResponse.json(
      { ok: false, message: "NISN atau tanggal lahir tidak valid." },
      { status: 400 },
    );
  }

  const limited = enforceStudentLoginRateLimit(req, nisn);
  if (limited) return limited;

  const email = studentLoginEmail(nisn);
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      passwordHash: true,
      isActive: true,
      role: true,
      schoolId: true,
      activeSchoolId: true,
    },
  });

  const fail = () => {
    recordStudentCredentialLoginFailure(email);
    return NextResponse.json(
      {
        ok: false,
        message:
          "NISN atau tanggal lahir tidak cocok, atau akun belum diaktifkan oleh sekolah.",
      },
      { status: 401 },
    );
  };

  if (!user?.passwordHash || !user.isActive || user.role !== "SISWA") {
    return fail();
  }

  const ok = await bcrypt.compare(tanggalLahir, user.passwordHash);
  if (!ok) {
    return fail();
  }

  clearStudentCredentialLoginFailures(email);

  const schoolId = user.activeSchoolId ?? user.schoolId;
  const subCheck = await assertSchoolLoginAllowed(schoolId);
  if (!subCheck.ok) {
    return NextResponse.json({ ok: false, message: subCheck.message }, { status: 403 });
  }

  return NextResponse.json({ ok: true as const });
}
