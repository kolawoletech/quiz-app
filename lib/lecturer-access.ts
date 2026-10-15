export function parseLecturerAllowlist(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAuthorizedLecturer(email: string, allowlist: ReadonlySet<string>) {
  return allowlist.has(email.trim().toLowerCase());
}
