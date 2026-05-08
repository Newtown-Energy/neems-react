export const isAdmin = (roles: readonly string[] | undefined | null): boolean =>
  !!roles && (
    roles.includes('admin') ||
    roles.includes('newtown-admin') ||
    roles.includes('newtown-staff')
  );

export const isSuperAdmin = (roles: readonly string[] | undefined | null): boolean =>
  !!roles && (
    roles.includes('newtown-admin') ||
    roles.includes('newtown-staff')
  );
