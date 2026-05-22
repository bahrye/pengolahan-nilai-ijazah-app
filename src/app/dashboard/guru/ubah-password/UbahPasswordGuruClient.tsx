"use client";

import { useRouter } from "next/navigation";

import {
  ChangeOwnPasswordForm,
  type ChangeOwnPasswordInput,
} from "@/components/account/ChangeOwnPasswordForm";
import { changeGuruOwnPasswordAction } from "@/server/actions/guru-self-password";

export function UbahPasswordGuruClient() {
  const router = useRouter();

  async function onSubmit(data: ChangeOwnPasswordInput) {
    const res = await changeGuruOwnPasswordAction(data);
    if (!res.ok) return { ok: false as const, message: res.message };
    return { ok: true as const };
  }

  return (
    <ChangeOwnPasswordForm
      description="Ganti sandi login email dari PIN awal ke sandi pilihan Anda. Sandi lama tidak bisa dipakai lagi setelah berhasil disimpan. Jika lupa sandi, minta administrator sekolah melakukan reset sandi."
      currentPasswordPlaceholder="PIN atau sandi saat ini"
      successMessage="Sandi berhasil diubah. PIN lama tidak berlaku lagi; kartu login di admin dinonaktifkan."
      onSubmit={onSubmit}
      onSuccess={() => router.refresh()}
    />
  );
}
