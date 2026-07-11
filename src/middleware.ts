import { defineMiddleware } from 'astro:middleware';
import { createClient } from '@supabase/supabase-js';
import { ADMIN_SESSION_COOKIE, isAdminPath, isProtectedAdminPath } from './lib/admin-guard';

async function isValidToken(token: string): Promise<boolean> {
  try {
    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL ?? '',
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data, error } = await supabase.auth.getUser(token);
    return !error && Boolean(data.user);
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
