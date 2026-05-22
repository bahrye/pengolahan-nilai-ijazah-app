import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/** Mirror of `UserRole` in Prisma — keep middleware edge bundle free of `@prisma/client`. */
export type AppUserRole = "SUPERADMIN" | "ADMIN_SEKOLAH" | "GURU" | "SISWA";

/**
 * Konfigurasi NextAuth untuk Edge (middleware): tanpa Prisma / bcrypt / adapter.
 * JWT penuh (termasuk `schoolId` konteks guru) ditulis di `auth.ts` (Node); di sini kita
 * hanya meneruskan klaim yang sudah ada di token agar `req.auth` tetap benar tanpa membesarkan bundle Edge.
 */
export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "",
      /** Penautan aman dilakukan di `auth.ts` → `ensureGoogleAccountLinked` untuk email terdaftar. */
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (trigger === "update" && session) {
        const patch = session as { impersonatingSchoolId?: string | null };
        if (patch.impersonatingSchoolId !== undefined) {
          token.impersonatingSchoolId = patch.impersonatingSchoolId;
          token.schoolId = patch.impersonatingSchoolId;
        }
      }

      if (user) {
        const u = user as {
          id: string;
          role?: AppUserRole;
          schoolId?: string | null;
          impersonatingSchoolId?: string | null;
        };
        token.sub = u.id;
        token.role = u.role ?? "ADMIN_SEKOLAH";
        token.schoolId = u.schoolId ?? null;
        if (u.impersonatingSchoolId !== undefined) {
          token.impersonatingSchoolId = u.impersonatingSchoolId;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = typeof token.sub === "string" ? token.sub : "";
      session.user.role = (token.role as AppUserRole) ?? "ADMIN_SEKOLAH";
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
  },
} satisfies NextAuthConfig;
