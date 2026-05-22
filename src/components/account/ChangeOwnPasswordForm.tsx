"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";

import { useToast } from "@/components/ToastProvider";

function PasswordField({
  id,
  name,
  label,
  autoComplete,
  placeholder,
  required,
  minLength,
  maxLength,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  placeholder: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-slate-800 dark:text-slate-100">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          className="ui-input w-full pr-11"
          placeholder={placeholder}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-500 outline-none transition hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-slate-400 dark:hover:text-slate-100"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Sembunyikan sandi" : "Tampilkan sandi"}
          aria-controls={id}
          aria-pressed={show}
        >
          {show ? (
            <EyeOff className="size-4 shrink-0" strokeWidth={2} aria-hidden />
          ) : (
            <Eye className="size-4 shrink-0" strokeWidth={2} aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
}

export type ChangeOwnPasswordInput = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export function ChangeOwnPasswordForm(props: {
  title?: string;
  description: string;
  currentPasswordPlaceholder?: string;
  successMessage: string;
  onSubmit: (
    data: ChangeOwnPasswordInput,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  onSuccess?: () => void;
}) {
  const formId = useId();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const res = await props.onSubmit({
      currentPassword: String(fd.get("currentPassword") ?? ""),
      newPassword: String(fd.get("newPassword") ?? ""),
      confirmPassword: String(fd.get("confirmPassword") ?? ""),
    });
    setBusy(false);
    if (res.ok) {
      toast(props.successMessage, "success");
      (e.currentTarget as HTMLFormElement).reset();
      props.onSuccess?.();
    } else {
      toast(res.message, "error");
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <div>
        <h1 className="ui-page-title">{props.title ?? "Ubah password"}</h1>
        <p className="ui-muted mt-1 text-pretty text-sm">{props.description}</p>
      </div>

      <section className="ui-card ui-card-tight space-y-4">
        <form id={formId} onSubmit={handleSubmit} className="space-y-4">
          <PasswordField
            id={`${formId}-current`}
            name="currentPassword"
            label="Sandi lama"
            autoComplete="current-password"
            placeholder={props.currentPasswordPlaceholder ?? "Sandi saat ini"}
            required
          />
          <PasswordField
            id={`${formId}-new`}
            name="newPassword"
            label="Sandi baru"
            autoComplete="new-password"
            placeholder="Minimal 8 karakter"
            required
            minLength={8}
            maxLength={128}
          />
          <PasswordField
            id={`${formId}-confirm`}
            name="confirmPassword"
            label="Konfirmasi sandi baru"
            autoComplete="new-password"
            placeholder="Ulangi sandi baru"
            required
            minLength={8}
            maxLength={128}
          />
          <button type="submit" disabled={busy} className="ui-btn ui-btn-primary w-full sm:w-auto">
            {busy ? "Menyimpan…" : "Simpan sandi baru"}
          </button>
        </form>
      </section>
    </div>
  );
}
