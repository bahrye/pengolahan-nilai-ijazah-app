import { describe, expect, it } from "vitest";

import {
  assertStudentCredentialLoginAllowed,
  clearStudentCredentialLoginFailures,
  recordStudentCredentialLoginFailure,
} from "./login-rate-limit";

describe("student credential rate limit", () => {
  const id = "1234567890@ijazah.ku";

  it("blocks after repeated failures", () => {
    clearStudentCredentialLoginFailures(id);
    expect(assertStudentCredentialLoginAllowed(id)).toBe(true);
    for (let i = 0; i < 8; i++) {
      recordStudentCredentialLoginFailure(id);
    }
    expect(assertStudentCredentialLoginAllowed(id)).toBe(false);
    clearStudentCredentialLoginFailures(id);
    expect(assertStudentCredentialLoginAllowed(id)).toBe(true);
  });
});
