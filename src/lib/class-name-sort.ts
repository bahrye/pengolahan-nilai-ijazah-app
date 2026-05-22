/** Label tampilan untuk siswa tanpa kelas. */
export const NO_CLASS_LABEL = "—";

function romanToNum(r: string): number | null {
  const map: Record<string, number> = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000,
  };
  const upper = r.toUpperCase();
  if (!/^[IVXLCDM]+$/.test(upper)) return null;
  let total = 0;
  for (let i = 0; i < upper.length; i++) {
    const cur = map[upper[i]];
    const nxt = map[upper[i + 1]] ?? 0;
    total += cur < nxt ? -cur : cur;
  }
  return total;
}

function classNameSortKey(name: string): (number | string)[] {
  const tokens = name.split(/([.\s\-/]+)/);
  const key: (number | string)[] = [];
  for (const t of tokens) {
    const trimmed = t.trim();
    if (!trimmed) continue;
    const asNum = Number(trimmed);
    if (!Number.isNaN(asNum)) {
      key.push(asNum);
      continue;
    }
    const asRoman = romanToNum(trimmed);
    if (asRoman !== null) {
      key.push(asRoman);
      continue;
    }
    key.push(trimmed.toLowerCase());
  }
  return key;
}

/** Urutkan nama kelas (angka & romawi) — nilai negatif = a lebih rendah dari b. */
export function compareClassName(a: string, b: string): number {
  const ka = classNameSortKey(a);
  const kb = classNameSortKey(b);
  const len = Math.max(ka.length, kb.length);
  for (let i = 0; i < len; i++) {
    const va = ka[i];
    const vb = kb[i];
    if (va === undefined && vb !== undefined) return -1;
    if (va !== undefined && vb === undefined) return 1;
    if (typeof va === "number" && typeof vb === "number") {
      if (va !== vb) return va - vb;
    } else if (typeof va === "string" && typeof vb === "string") {
      const cmp = va.localeCompare(vb, "id");
      if (cmp !== 0) return cmp;
    } else {
      if (typeof va === "number") return -1;
      return 1;
    }
  }
  return 0;
}

export function studentClassLabel(classLabel: string | null | undefined): string {
  const t = classLabel?.trim();
  return t || NO_CLASS_LABEL;
}

export function uniqueClassLabelsSorted(
  students: { classLabel: string | null | undefined }[],
): string[] {
  const set = new Set<string>();
  for (const s of students) {
    set.add(studentClassLabel(s.classLabel));
  }
  return [...set].sort(compareClassName);
}

/** Kelas terendah menurut compareClassName (mis. 6 sebelum 7, X sebelum XI). */
export function lowestClassLabel(
  students: { classLabel: string | null | undefined }[],
): string | null {
  const sorted = uniqueClassLabelsSorted(students);
  return sorted[0] ?? null;
}
