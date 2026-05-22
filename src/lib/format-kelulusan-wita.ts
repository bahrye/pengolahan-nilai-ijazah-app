/**
 * Format tanggal & jam pengumuman di zona waktu peramban (WIB/WITA/WIT).
 * @deprecated Import langsung dari `@/lib/indonesia-timezone` bila memungkinkan.
 */

export {
  formatInstantForBrowser as formatKelulusanTanggalWaktuLokal,
  formatInstantForBrowser,
  indonesiaTzAbbrevFromOffsetHours,
  utcOffsetHoursAt as utcOffsetHoursLocalAt,
} from "@/lib/indonesia-timezone";
