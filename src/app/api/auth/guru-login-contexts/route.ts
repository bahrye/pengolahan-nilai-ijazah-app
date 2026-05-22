import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { ADMIN_ACCOUNT_DEACTIVATED_MESSAGE } from "@/lib/admin-account-status";
import { enforceLoginPreviewRateLimit } from "@/lib/login-rate-limit";
import { prisma } from "@/lib/prisma";
import {
  isSchoolActiveForAccess,
  LOGIN_QUERY_SCHOOL_DEACTIVATED,
  SCHOOL_DEACTIVATED_MESSAGE,
} from "@/lib/school-active";
import { fetchGuruSchoolContextRowsForUser } from "@/server/guru-school-contexts";
import {
  assertSchoolLoginAllowed,
  schoolLoginBlockedMessage,
} from "@/server/subscription-access";

import type { UserRole } from "@prisma/client";

type Body = {
  email?: unknown;
  password?: unknown;
  /** Validasi ulang sekolah yang dipilih sebelum signIn (multi-sekolah). */
  contextSchoolId?: unknown;
};

/**
 * Pratinjau konteks sekolah untuk guru (setelah sandi benar): memutuskan
 * apakah UI perlu pemilih sekolah sebelum `signIn("credentials", …)`.
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, message: "Format tidak valid." }, { status: 400 });
  }

  const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!rawEmail || !password) {
    return NextResponse.json({ ok: false, message: "Email dan sandi wajib diisi." }, { status: 400 });
  }

  const limited = enforceLoginPreviewRateLimit(req, rawEmail);
  if (limited) return limited;

  const email = /^[0-9]{10}$/.test(rawEmail) ? `${rawEmail}@ijazah.ku` : rawEmail;

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      passwordHash: true,
      isActive: true,
      role: true,
      schoolId: true,
    },
  });

  if (!user?.passwordHash) {
    return NextResponse.json({ ok: false, message: "Email atau sandi salah." }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ ok: false, message: "Email atau sandi salah." }, { status: 401 });
  }

  if (!user.isActive) {
    if (user.role === "ADMIN_SEKOLAH") {
      return NextResponse.json(
        { ok: false, message: ADMIN_ACCOUNT_DEACTIVATED_MESSAGE, code: "account_deactivated" },
        { status: 403 },
      );
    }
    return NextResponse.json({ ok: false, message: "Email atau sandi salah." }, { status: 401 });
  }

  if (user.role !== "GURU") {
    if (user.role === "ADMIN_SEKOLAH" && !(await isSchoolActiveForAccess(user.schoolId))) {
      return NextResponse.json(
        {
          ok: false,
          message: SCHOOL_DEACTIVATED_MESSAGE,
          code: LOGIN_QUERY_SCHOOL_DEACTIVATED,
        },
        { status: 403 },
      );
    }
    return NextResponse.json({
      ok: true as const,
      needSchoolPicker: false,
      role: user.role as UserRole,
    });
  }

  const schools = await fetchGuruSchoolContextRowsForUser(user.id, user.schoolId);
  if (schools.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        message: "Akun guru ini belum terikat penugasan di sekolah manapun.",
      },
      { status: 403 },
    );
  }

  const contextSchoolId =
    typeof body.contextSchoolId === "string" ? body.contextSchoolId.trim() : "";
  if (contextSchoolId) {
    const allowed = new Set(schools.map((s) => s.schoolId));
    if (!allowed.has(contextSchoolId)) {
      return NextResponse.json(
        { ok: false, message: "Sekolah yang dipilih tidak valid untuk akun ini." },
        { status: 403 },
      );
    }
    const subCheck = await assertSchoolLoginAllowed(contextSchoolId);
    if (!subCheck.ok) {
      return NextResponse.json({ ok: false, message: subCheck.message }, { status: 403 });
    }
    return NextResponse.json({ ok: true as const, needSchoolPicker: false, schools });
  }

  const subscribedSchools: typeof schools = [];
  for (const row of schools) {
    if (await assertSchoolLoginAllowed(row.schoolId).then((r) => r.ok)) {
      subscribedSchools.push(row);
    }
  }

  if (subscribedSchools.length === 0) {
    let message = schoolLoginBlockedMessage();
    for (const row of schools) {
      const check = await assertSchoolLoginAllowed(row.schoolId);
      if (!check.ok) {
        message = check.message;
        break;
      }
    }
    return NextResponse.json({ ok: false, message }, { status: 403 });
  }

  return NextResponse.json({
    ok: true as const,
    needSchoolPicker: subscribedSchools.length > 1,
    schools: subscribedSchools,
  });
}
