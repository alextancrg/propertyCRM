/**
 * Phone number helpers. The CRM is Malaysia-focused (LHDN, MYR), so phone
 * numbers are normalized to E.164 with the +60 country code so they work with
 * Twilio WhatsApp outbound sends.
 */

/**
 * Normalize a phone number to E.164 international format.
 *
 *   "012-345 6789" → "+60123456789"
 *   "0123456789"   → "+60123456789"
 *   "60123456789"  → "+60123456789"
 *   "+60123456789" → "+60123456789" (unchanged)
 *   "006012345678" → "+60123456789"
 *   "+6591234567"  → "+6591234567"  (foreign numbers with a "+" are kept)
 *
 * Returns null when the input is empty or contains no digits.
 */
export function normalizePhoneE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;

  // Already international (starts with "+") — keep it, just tidy the digits.
  // This preserves foreign numbers like +65… instead of mis-reading them as +60.
  if (trimmed.startsWith("+")) {
    return `+${trimmed.replace(/\D/g, "")}`;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  // "00..." is the international dialing prefix — treat it as +<country>...
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;

  // Already carries the country code (with or without the leading "+").
  if (digits.startsWith("60")) return `+${digits}`;

  // Malaysian local number — replace the leading 0 with +60 (e.g. 01x… → +601…).
  if (digits.startsWith("0")) return `+60${digits.slice(1)}`;

  // Plain digits without a country code — assume Malaysian.
  return `+60${digits}`;
}
