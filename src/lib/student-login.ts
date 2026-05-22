const STUDENT_LOGIN_EMAIL_SUFFIX = "@ijazah.ku";

/** Email sintetis untuk akun login siswa (NISN 10 digit). */
export function studentLoginEmail(nisn: string): string {
  return `${nisn.replace(/\D/g, "").slice(0, 10)}${STUDENT_LOGIN_EMAIL_SUFFIX}`;
}

/** Untuk UI: tampilkan NISN saja (tanpa domain sintetis). */
export function displayStudentLoginEmail(email: string): string {
  const lower = email.toLowerCase();
  if (lower.endsWith(STUDENT_LOGIN_EMAIL_SUFFIX)) {
    return email.slice(0, lower.length - STUDENT_LOGIN_EMAIL_SUFFIX.length);
  }
  return email;
}

/** Sandi login siswa = tanggal lahir terformat `DD-MM-YYYY` (sama seperti saat provisioning). */
export function passwordFromBirthDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  return `${dd}-${mm}-${yyyy}`;
}
