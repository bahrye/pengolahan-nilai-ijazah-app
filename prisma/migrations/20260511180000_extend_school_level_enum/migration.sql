-- Tambah nilai enum jenjang (Kemdikbud, PAUD, PKBM, SLB, dll.) — hanya penambahan, aman untuk data lama.
ALTER TYPE "SchoolLevel" ADD VALUE 'KB';
ALTER TYPE "SchoolLevel" ADD VALUE 'TK';
ALTER TYPE "SchoolLevel" ADD VALUE 'RA';
ALTER TYPE "SchoolLevel" ADD VALUE 'TPA';
ALTER TYPE "SchoolLevel" ADD VALUE 'SD';
ALTER TYPE "SchoolLevel" ADD VALUE 'SDLB';
ALTER TYPE "SchoolLevel" ADD VALUE 'SMP';
ALTER TYPE "SchoolLevel" ADD VALUE 'SMPLB';
ALTER TYPE "SchoolLevel" ADD VALUE 'SMA';
ALTER TYPE "SchoolLevel" ADD VALUE 'SMALB';
ALTER TYPE "SchoolLevel" ADD VALUE 'SMK';
ALTER TYPE "SchoolLevel" ADD VALUE 'SLB';
ALTER TYPE "SchoolLevel" ADD VALUE 'PKBM';
