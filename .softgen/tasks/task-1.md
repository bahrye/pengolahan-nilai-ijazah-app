---
title: "Optimasi Performa Database & Query"
status: "in_progress"
priority: "urgent"
type: "chore"
tags: ["performance", "database", "critical"]
created_by: "agent"
created_at: "2026-05-11T07:50:09Z"
position: 1
---

## Notes

Masalah kritis yang menyebabkan website lambat pada data skala besar:
- Query tanpa pagination memuat ribuan records sekaligus
- Missing database indexes untuk query patterns yang sering digunakan
- Transaction bisa timeout karena terlalu banyak operasi
- Tidak ada caching mechanism untuk session dan computed data

Target: Reduce database query time dari 8-15s menjadi 1-2s untuk operasi nilai.

## Checklist

- [x] Tambah missing indexes di schema.prisma (scoreType, combined indexes)
- [x] Implementasi batching untuk persistMatrix (max 500 ops per transaction)
- [x] Optimize queries dengan select only needed fields
- [x] Cache session data dengan React cache() untuk menghindari auth query berulang
- [ ] Tambah pagination atau cursor-based loading untuk grade matrix (opsional - dataset limit sudah OK)
- [ ] Optimize allowedGradeTargetsForRole dengan caching atau single query join
- [ ] Tambah database connection pooling configuration

## Acceptance

- Query load nilai selesai dalam <2 detik untuk 500+ siswa
- Save bulk scores tidak timeout bahkan untuk 1000+ updates
- Auth checks tidak hit database pada setiap server action call