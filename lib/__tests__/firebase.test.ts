import { describe, expect, it } from "vitest";

import { getFirebaseAuth, hasFirebaseConfig } from "@/lib/firebase";

describe("Firebase client configuration", () => {
  it("does not initialize Firebase when deployment settings are missing", () => {
    expect(hasFirebaseConfig()).toBe(false);
    expect(() => getFirebaseAuth()).toThrow("Firebase is not configured for this deployment.");
  });
});
