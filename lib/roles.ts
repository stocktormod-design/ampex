export const APP_ROLES = ["owner", "admin", "installator", "montor", "apprentice"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export function isAdminRole(role: string): boolean {
  return role === "owner" || role === "admin";
}

/** Innboks for installatør-godkjenning av ordre (admins ser alt i selskapet). */
export function canViewInstallerInbox(role: string): boolean {
  return role === "installator" || isAdminRole(role);
}

export function roleLabel(role: string): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "installator":
      return "Installatør";
    case "montor":
    case "worker":
      return "Montør";
    case "apprentice":
      return "Lærling";
    default:
      return role;
  }
}

export function isAssignableRole(role: string): role is AppRole {
  return (APP_ROLES as readonly string[]).includes(role);
}
