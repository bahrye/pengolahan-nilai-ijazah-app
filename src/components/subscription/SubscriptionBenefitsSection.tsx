import { Check, Sparkles } from "lucide-react";

import { FREE_STUDENT_ADD_QUOTA } from "@/lib/subscription/constants";
import {
  getSubscriptionPremiumBenefitCategories,
} from "@/lib/subscription/premium-benefits";
import { institutionNoun } from "@/lib/school-terminology";

import type { SchoolLevel } from "@prisma/client";

export function SubscriptionBenefitsSection({
  schoolJenjang = null,
}: {
  schoolJenjang?: SchoolLevel | null;
}) {
  const categories = getSubscriptionPremiumBenefitCategories(schoolJenjang);
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-600/80 dark:bg-slate-900/40">
      <div className="border-b border-indigo-100/80 bg-gradient-to-br from-indigo-600 via-violet-600 to-indigo-800 px-5 py-5 sm:px-6 dark:border-indigo-500/25">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white ring-1 ring-white/25">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">
              Keuntungan berlangganan
            </h2>
            <p className="text-sm leading-relaxed text-indigo-100/95">
              Satu langganan untuk {institutionNoun(schoolJenjang)} Anda: admin, guru mapel,
              wali kelas, dan siswa bekerja dalam satu alur nilai ijazah yang rapi.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-8 p-5 sm:p-6">
        {categories.map((category) => (
          <div key={category.id} className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-indigo-700 dark:text-indigo-300">
              {category.label}
            </h3>
            <ul className="grid gap-3 sm:grid-cols-2">
              {category.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li
                    key={item.title}
                    className="flex gap-3 rounded-xl border border-slate-200/90 bg-slate-50/80 p-4 transition hover:border-indigo-200/90 hover:bg-indigo-50/40 dark:border-slate-600/70 dark:bg-slate-800/35 dark:hover:border-indigo-500/35 dark:hover:bg-indigo-950/25"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0 space-y-1">
                      <p className="font-semibold leading-snug text-slate-900 dark:text-slate-50">
                        {item.title}
                      </p>
                      <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">
                        {item.description}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <div className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm leading-relaxed text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/35 dark:text-amber-100">
          <p className="flex gap-2 font-medium">
            <Check className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <span>
              Tanpa langganan aktif, login guru dan siswa nonaktif. Paket gratis tetap
              mengizinkan pengelolaan data dasar dengan batas{" "}
              <strong>{FREE_STUDENT_ADD_QUOTA} penambahan siswa</strong> (kumulatif) dan
              penggunaan admin <strong>3 jam per hari</strong>.
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
