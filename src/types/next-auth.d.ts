import type { UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: UserRole;
      schoolId: string | null;
      /** Sekolah yang sedang diakses superadmin (impersonasi admin sekolah). */
      impersonatingSchoolId: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    schoolId?: string | null;
    impersonatingSchoolId?: string | null;
  }
}
