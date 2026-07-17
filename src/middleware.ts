import { defineMiddleware } from 'astro:middleware';
import { createClient } from '@supabase/supabase-js';
import { ADMIN_SESSION_COOKIE, isAdminPath, isProtectedAdminPath } from './lib/admin-guard';

// Authenticate AND authorise: a valid Supabase session is not enough because
// other auth users may exist. The token holder must be the configured admin.
const ADMIN_EMAIL = (import.meta.env.ADMIN_EMAIL ?? 'charlie@camberco.co.uk').toLowerCase();

async function isValidToken(token: string): Promise<boolean> {
  try {
    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL ?? '',
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return false;
    return (data.user.email ?? '').toLowerCase() === ADMIN_EMAIL;
  } catch {
    return false;
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  if (!isAdminPath(pathname)) {
    return next();
  }

  if (isProtectedAdminPath(pathname)) {
    const token = context.cookies.get(ADMIN_SESSION_COOKIE)?.value ?? '';
    const valid = token ? await isValidToken(token) : false;
    if (!valid) {
      const redirect = context.redirect('/admin/login', 302);
      redirect.headers.set('X-Robots-Tag', 'noindex, nofollow');
      return redirect;
    }
  }

  const response = await next();
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
});
