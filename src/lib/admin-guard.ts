// Path rules for the server-side admin gate (src/middleware.ts) and the
// cookie the client login flow uses to hand its Supabase access token to
// the server. The cookie mirrors the localStorage session that
// supabase-js already maintains; it is validated on every admin request
// with supabase.auth.getUser(token).
export const ADMIN_SESSION_COOKIE = 'camber-admin-token';

const PUBLIC_ADMIN_PATHS = new Set(['/admin/login', '/admin/auth/callback']);

function normalise(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

export function isAdminPath(pathname: string): boolean {
  const p = normalise(pathname);
  return p === '/admin' || p.startsWith('/admin/');
}

export function isProtectedAdminPath(pathname: string): boolean {
  if (!isAdminPath(pathname)) return false;
  return !PUBLIC_ADMIN_PATHS.has(normalise(pathname));
}
