/** The one account allowed to author content (R11). A constant, so no env value can widen it. */
export const ADMIN_EMAIL = "davidsathyandevice@gmail.com";

export function isAdminEmail(email: string): boolean {
  return email.trim().toLowerCase() === ADMIN_EMAIL;
}
