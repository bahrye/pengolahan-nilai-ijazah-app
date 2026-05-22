"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

type PasswordInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "className"
> & {
  /** Class pada wrapper (posisi relatif). */
  className?: string;
  inputClassName?: string;
};

export function PasswordInput({
  className,
  inputClassName,
  ...props
}: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className={className ?? "relative"}>
      <input
        {...props}
        type={show ? "text" : "password"}
        className={inputClassName}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={show ? "Sembunyikan sandi" : "Tampilkan sandi"}
        className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        onClick={() => setShow((v) => !v)}
      >
        {show ? <EyeOff className="size-[18px]" aria-hidden /> : <Eye className="size-[18px]" aria-hidden />}
      </button>
    </div>
  );
}
