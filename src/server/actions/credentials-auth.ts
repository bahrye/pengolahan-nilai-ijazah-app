"use server";

import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { headers } from "next/headers";
import { z } from "zod";

import {
  GURU_PIN_PASSWORD_RESET_MESSAGE,
  guruUserUsesDefaultLoginPin,
} from "@/lib/guru-login-pin";
import { clientIpFromHeaders } from "@/lib/http/client-ip";
import { enforcePasswordResetRateLimit } from "@/lib/login-rate-limit";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/server/email/resend-reset";

const emailSchema = z.string().trim().email("Format email tidak valid.");
const passwordSchema = z
  .string()
  .min(8, "Sandi minimal 8 karakter.")
  .max(72, "Sandi terlalu panjang (maks. 72 karakter).");

export async function requestPasswordResetAction(
  emailRaw: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  let email: string;
  try {
    email = emailSchema.parse(emailRaw).toLowerCase();
  } catch {
    return { ok: false, message: "Format email tidak valid." };
  }

  const h = await headers();
  const rate = enforcePasswordResetRateLimit(email, clientIpFromHeaders(h));
  if (!rate.ok) return rate;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, role: true },
  });

  if (!user?.passwordHash) {
    return { ok: true };
  }

  if (user.role === "GURU" && (await guruUserUsesDefaultLoginPin(user.id))) {
    return { ok: false, message: GURU_PIN_PASSWORD_RESET_MESSAGE };
  }

  const tokenPlain = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  const expires = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.verificationToken.deleteMany({
    where: { identifier: email },
  });

  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: tokenPlain,
      expires,
    },
  });

  await sendPasswordResetEmail(email, tokenPlain);

  return { ok: true };
}

export async function resetPasswordWithTokenAction(
  tokenPlain: unknown,
  passwordRaw: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const tokenOk = z.string().trim().min(10).safeParse(tokenPlain);
  if (!tokenOk.success)
    return { ok: false, message: "Tautan tidak valid atau sudah kadaluarsa." };

  let password: string;
  try {
    password = passwordSchema.parse(passwordRaw);
  } catch {
    return { ok: false, message: "Sandi tidak valid (minimal 8 karakter)." };
  }

  const record = await prisma.verificationToken.findUnique({
    where: { token: tokenOk.data },
  });

  if (!record || record.expires.getTime() < Date.now())
    return { ok: false, message: "Tautan tidak valid atau sudah kadaluarsa." };

  const user = await prisma.user.findUnique({
    where: { email: record.identifier },
    select: { id: true, role: true },
  });
  if (!user)
    return { ok: false, message: "Pengguna tidak ditemukan." };

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    if (user.role === "GURU") {
      await tx.teacher.updateMany({
        where: { userId: user.id },
        data: { lastPlainPassword: null, usesDefaultLoginPin: false },
      });
    }
    await tx.verificationToken.delete({ where: { token: tokenOk.data } });
  });

  return { ok: true };
}
