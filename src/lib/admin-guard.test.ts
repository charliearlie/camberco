import { describe, expect, it } from 'vitest';
import { isAdminPath, isProtectedAdminPath } from './admin-guard';

describe('isAdminPath', () => {
  it('matches /admin and nested admin routes, with or without trailing slash', () => {
    expect(isAdminPath('/admin')).toBe(true);
    expect(isAdminPath('/admin/')).toBe(true);
    expect(isAdminPath('/admin/editor')).toBe(true);
    expect(isAdminPath('/admin/editor/abc-123')).toBe(true);
  });

  it('ignores non-admin routes, lookalikes and API routes', () => {
    expect(isAdminPath('/')).toBe(false);
    expect(isAdminPath('/administrator')).toBe(false);
    expect(isAdminPath('/api/admin/auth')).toBe(false);
  });
});

describe('isProtectedAdminPath', () => {
  it('protects the dashboard, editor, enquiries and settings', () => {
    expect(isProtectedAdminPath('/admin')).toBe(true);
    expect(isProtectedAdminPath('/admin/editor')).toBe(true);
    expect(isProtectedAdminPath('/admin/editor/abc-123')).toBe(true);
    expect(isProtectedAdminPath('/admin/enquiries')).toBe(true);
    expect(isProtectedAdminPath('/admin/settings')).toBe(true);
  });

  it('leaves login and the auth callback public', () => {
    expect(isProtectedAdminPath('/admin/login')).toBe(false);
    expect(isProtectedAdminPath('/admin/login/')).toBe(false);
    expect(isProtectedAdminPath('/admin/auth/callback')).toBe(false);
  });

  it('is false for non-admin paths', () => {
    expect(isProtectedAdminPath('/contact')).toBe(false);
  });
});
