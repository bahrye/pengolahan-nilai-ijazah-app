import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/** Flat config asli Next.js 16 — hindari FlatCompat yang memicu error serialisasi di ESLint 9. */
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      "react/no-unescaped-entities": "off",
      "@next/next/no-html-link-for-pages": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
      /** Pola muat-data di client (reset state + mulai loading) sah; aturan baru terlalu ketat untuk fetch non-Suspense. */
      "react-hooks/set-state-in-effect": "off",
      /** Rumus waktu/countdown dan dirty-check grid memakai pola yang sah; pemeriksaan purity/refs ini belum selebar kasus nyata aplikasi. */
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
    },
  },
];

export default eslintConfig;
