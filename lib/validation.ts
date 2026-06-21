export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function cleanString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}
