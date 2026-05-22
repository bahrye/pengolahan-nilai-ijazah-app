import { CredentialsSignin } from "@auth/core/errors";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";

import { authConfig, type AppUserRole } from "@/auth.config";
import { getSuperadminEmailsFromEnv } from "@/lib/email/recipients";
import {
  assertCredentialLoginAllowed,
  assertStudentCredentialLoginAllowed,
  clearCredentialLoginFailures,
  clearStudentCredentialLoginFailures,
  recordCredentialLoginFailure,
  recordStudentCredentialLoginFailure,
} from "@/lib/login-rate-limit";
import { prisma } from "@/lib/prisma";
import { CREDENTIALS_ERROR_ACCOUNT_DEACTIVATED } from "@/lib/admin-account-status";
import {
  CREDENTIALS_ERROR_SCHOOL_DEACTIVATED,
  isSchoolActiveForAccess,
  LOGIN_QUERY_SCHOOL_DEACTIVATED,
} from "@/lib/school-active";
import { studentLoginEmail } from "@/lib/student-login";
import {
  getPlatformMaintenance,
  isPlatformMaintenanceBlocking,
} from "@/lib/platform-maintenance";
import { ensureGoogleAccountLinked } from "@/server/google-account-link";
import { fetchGuruSchoolContextRowsForUser } from "@/server/guru-school-contexts";
import { applyGuruLoginSchoolContext } from "@/server/guru-login-school";
import { isSchoolLoginAllowed } from "@/server/subscription-access";

import type { UserRole } from "@prisma/client";

function adminEmailSet(): Set<string> {
  return new Set(getSuperadminEmailsFromEnv());
}

function effectiveSessionSchoolId(opts: {
  role: UserRole;
  schoolId: string | null;
  activeSchoolId: string | null;
}): string | null {
  if (opts.role === "GURU" || opts.role === "SUPERADMIN") {
    return opts.activeSchoolId ?? opts.schoolId;
  }
  return opts.schoolId;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    ...authConfig.providers,
    Credentials({
      id: "credentials",
      name: "Email dan sandi",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Sandi", type: "password" },
        contextSchoolId: { label: "Konteks sekolah", type: "text" },
      },
      async authorize(credentials) {
        const rawEmail = credentials?.email;
        const rawPassword = credentials?.password;
        const rawContext =
          typeof credentials?.contextSchoolId === "string"
            ? credentials.contextSchoolId.trim()
            : "";
        const identifier =
          typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
        const password = typeof rawPassword === "string" ? rawPassword : "";
        if (!identifier || !password) return null;

        const email = /^[0-9]{10}$/.test(identifier)
          ? studentLoginEmail(identifier)
          : identifier;

        if (!assertCredentialLoginAllowed(email)) return null;

        const fail = () => {
          recordCredentialLoginFailure(email);
          return null;
        };

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return fail();

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return fail();

        if (!user.isActive) {
          if (user.role === "ADMIN_SEKOLAH") {
            const err = new CredentialsSignin();
            err.code = CREDENTIALS_ERROR_ACCOUNT_DEACTIVATED;
            throw err;
          }
          return fail();
        }

        /** Login siswa hanya lewat `/login/siswa` (provider terpisah). */
        if (user.role === "SISWA") return fail();

        if (user.role === "GURU") {
          const options = await fetchGuruSchoolContextRowsForUser(user.id, user.schoolId);
          if (options.length === 0) return fail();

          const allowed = new Set(options.map((o) => o.schoolId));
          let chosenSchoolId: string;
          if (options.length === 1) {
            const sole = options[0];
            if (!sole) return fail();
            chosenSchoolId = sole.schoolId;
            if (rawContext && allowed.has(rawContext)) {
              chosenSchoolId = rawContext;
            }
          } else {
            if (!rawContext || !allowed.has(rawContext)) return fail();
            chosenSchoolId = rawContext;
          }

          const homeId = user.schoolId;
          const nextActive =
            homeId != null && chosenSchoolId === homeId ? null : chosenSchoolId;

          await prisma.user.update({
            where: { id: user.id },
            data: { activeSchoolId: nextActive },
          });

          const refreshed = await prisma.user.findUnique({
            where: { id: user.id },
            select: { role: true, schoolId: true, activeSchoolId: true },
          });
          if (!refreshed) return fail();

          const guruSchoolId = effectiveSessionSchoolId({
            role: refreshed.role,
            schoolId: refreshed.schoolId,
            activeSchoolId: refreshed.activeSchoolId,
          });
          if (!(await isSchoolLoginAllowed(guruSchoolId))) return fail();

          clearCredentialLoginFailures(email);
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image ?? undefined,
            role: user.role,
            schoolId: guruSchoolId,
          };
        }

        const schoolId = effectiveSessionSchoolId({
          role: user.role,
          schoolId: user.schoolId,
          activeSchoolId: user.activeSchoolId,
        });

        if (user.role === "ADMIN_SEKOLAH") {
          if (!(await isSchoolActiveForAccess(schoolId))) {
            const err = new CredentialsSignin();
            err.code = CREDENTIALS_ERROR_SCHOOL_DEACTIVATED;
            throw err;
          }
        }

        clearCredentialLoginFailures(email);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image ?? undefined,
          role: user.role,
          schoolId,
        };
      },
    }),
    Credentials({
      id: "siswa-credentials",
      name: "NISN dan tanggal lahir",
      credentials: {
        nisn: { label: "NISN", type: "text" },
        tanggalLahir: { label: "Tanggal lahir", type: "text" },
      },
      async authorize(credentials) {
        const nisnRaw = typeof credentials?.nisn === "string" ? credentials.nisn : "";
        const tanggalLahir =
          typeof credentials?.tanggalLahir === "string" ? credentials.tanggalLahir.trim() : "";
        const nisn = nisnRaw.replace(/\D/g, "").slice(0, 10);
        if (nisn.length !== 10 || !/^\d{2}-\d{2}-\d{4}$/.test(tanggalLahir)) return null;

        const email = studentLoginEmail(nisn);
        if (!assertStudentCredentialLoginAllowed(email)) return null;

        const fail = () => {
          recordStudentCredentialLoginFailure(email);
          return null;
        };

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash || !user.isActive || user.role !== "SISWA") return fail();

        const ok = await bcrypt.compare(tanggalLahir, user.passwordHash);
        if (!ok) return fail();

        const schoolId = effectiveSessionSchoolId({
          role: user.role,
          schoolId: user.schoolId,
          activeSchoolId: user.activeSchoolId,
        });
        if (!(await isSchoolActiveForAccess(schoolId))) {
          const err = new CredentialsSignin();
          err.code = CREDENTIALS_ERROR_SCHOOL_DEACTIVATED;
          throw err;
        }
        if (!(await isSchoolLoginAllowed(schoolId))) return fail();

        clearStudentCredentialLoginFailures(email);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image ?? undefined,
          role: user.role,
          schoolId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (trigger === "update") {
        const sub = typeof token.sub === "string" ? token.sub : null;
        if (!sub) return token;

        const patch = session as { impersonatingSchoolId?: string | null } | undefined;
        if (patch && patch.impersonatingSchoolId !== undefined) {
          await prisma.user.update({
            where: { id: sub },
            data: { activeSchoolId: patch.impersonatingSchoolId },
          });
        }

        const db = await prisma.user.findUnique({
          where: { id: sub },
          select: { role: true, schoolId: true, activeSchoolId: true, id: true },
        });
        if (db) {
          token.role = db.role as AppUserRole;
          token.schoolId = effectiveSessionSchoolId({
            role: db.role,
            schoolId: db.schoolId,
            activeSchoolId: db.activeSchoolId,
          });
          token.impersonatingSchoolId =
            db.role === "SUPERADMIN" ? db.activeSchoolId : null;
        }
        return token;
      }

      if (user) {
        const uid = user.id;
        if (!uid) {
          return token;
        }
        const db = await prisma.user.findUnique({
          where: { id: uid },
          select: { role: true, schoolId: true, activeSchoolId: true, id: true },
        });
        if (db) {
          token.sub = db.id;
          token.role = db.role as AppUserRole;
          token.schoolId = effectiveSessionSchoolId({
            role: db.role,
            schoolId: db.schoolId,
            activeSchoolId: db.activeSchoolId,
          });
          token.impersonatingSchoolId =
            db.role === "SUPERADMIN" ? db.activeSchoolId : null;
        } else {
          const u = user as {
            id: string;
            role?: AppUserRole;
            schoolId?: string | null;
          };
          token.sub = u.id;
          token.role = u.role ?? "ADMIN_SEKOLAH";
          token.schoolId = u.schoolId ?? null;
        }
      }

      const sub = typeof token.sub === "string" ? token.sub : null;
      if (sub && !user) {
        const db = await prisma.user.findUnique({
          where: { id: sub },
          select: { role: true, schoolId: true, activeSchoolId: true },
        });
        if (db?.role === "SUPERADMIN") {
          token.role = "SUPERADMIN";
          token.schoolId = effectiveSessionSchoolId({
            role: db.role,
            schoolId: db.schoolId,
            activeSchoolId: db.activeSchoolId,
          });
          token.impersonatingSchoolId = db.activeSchoolId;
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = typeof token.sub === "string" ? token.sub : "";
      session.user.role = (token.role as UserRole) ?? "ADMIN_SEKOLAH";
      const impersonatingSchoolId =
        typeof token.impersonatingSchoolId === "string"
          ? token.impersonatingSchoolId
          : null;
      session.user.impersonatingSchoolId = impersonatingSchoolId;
      session.user.schoolId =
        impersonatingSchoolId ??
        (typeof token.schoolId === "string" ? token.schoolId : null);
      return session;
    },
    async signIn({ user, account }) {
      const maintenance = await getPlatformMaintenance();
      if (isPlatformMaintenanceBlocking(maintenance)) {
        return "/maintenance";
      }

      if (account?.provider === "google") {
        const email = user.email?.toLowerCase() ?? "";
        const admins = adminEmailSet();

        if (admins.has(email)) return true;

        const dbUser = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            schoolId: true,
            activeSchoolId: true,
            role: true,
            isActive: true,
          },
        });

        if (!dbUser) {
          return "/login?error=google_not_registered";
        }

        if (!dbUser.isActive) {
          if (dbUser.role === "ADMIN_SEKOLAH") {
            return `/login?error=${CREDENTIALS_ERROR_ACCOUNT_DEACTIVATED}`;
          }
          return "/login?error=google_not_registered";
        }

        if (dbUser.role === "SISWA") {
          return "/login?error=google_not_registered";
        }

        await ensureGoogleAccountLinked(dbUser.id, account);

        if (dbUser.role === "SUPERADMIN") {
          return true;
        }

        if (dbUser.role === "ADMIN_SEKOLAH") {
          const adminSchoolId = effectiveSessionSchoolId({
            role: dbUser.role,
            schoolId: dbUser.schoolId,
            activeSchoolId: dbUser.activeSchoolId,
          });
          if (!(await isSchoolActiveForAccess(adminSchoolId))) {
            return `/login?error=${LOGIN_QUERY_SCHOOL_DEACTIVATED}`;
          }
          return true;
        }

        if (dbUser.role === "GURU") {
          const applied = await applyGuruLoginSchoolContext(dbUser.id, dbUser.schoolId);
          if (applied.ok) return true;
          if (applied.reason === "subscription_blocked") {
            return "/login?error=subscription_required";
          }
          return "/login?error=google_not_registered";
        }

        if (!dbUser.schoolId) {
          await prisma.account.deleteMany({ where: { userId: dbUser.id } });
          await prisma.user.delete({ where: { id: dbUser.id } });
          return "/login?error=google_not_registered";
        }

        return true;
      }
      return true;
    },
  },
  events: {
    async createUser({ user }) {
      const admins = adminEmailSet();
      const email = user.email?.toLowerCase() ?? "";
      const role: UserRole = admins.has(email) ? "SUPERADMIN" : "ADMIN_SEKOLAH";
      await prisma.user.update({
        where: { id: user.id },
        data: { role },
      });
    },
  },
});
