import { describe, expect, it } from 'vitest';
import {
  coerceValuePence,
  deriveCompletedAt,
  enquiryToClientPrefill,
  isClientSource,
  isClientStatus,
  isIsoDate,
  isOpenProjectStatus,
  isProjectStatus,
  isUuid,
  isValidEmail,
  normaliseEmail,
  parseClientCreate,
  parseClientUpdate,
  parseNoteCreate,
  parseProjectCreate,
  parseProjectUpdate,
  penceToGBP,
  penceToPounds,
  poundsToPence,
  sumOpenPipelinePence,
} from './crm';

const UUID = 'ed72a8bb-435a-4445-9064-6f0c388c4294';
const UUID2 = '11111111-2222-3333-4444-555555555555';

describe('money conversion', () => {
  it('formats pence as GBP with grouped thousands', () => {
    expect(penceToGBP(123450)).toBe('£1,234.50');
    expect(penceToGBP(0)).toBe('£0.00');
    expect(penceToGBP(50)).toBe('£0.50');
    expect(penceToGBP(100000000)).toBe('£1,000,000.00');
  });

  it('renders a dash for null/undefined and other currencies without a £', () => {
    expect(penceToGBP(null)).toBe('—');
    expect(penceToGBP(undefined)).toBe('—');
    expect(penceToGBP(123450, 'USD')).toBe('USD 1,234.50');
  });

  it('converts pounds strings (with symbols/commas) to integer pence', () => {
    expect(poundsToPence('1234.50')).toBe(123450);
    expect(poundsToPence('£1,234.50')).toBe(123450);
    expect(poundsToPence(1000)).toBe(100000);
    expect(poundsToPence('0.01')).toBe(1);
  });

  it('treats empty pounds as null and clamps negatives to 0', () => {
    expect(poundsToPence('')).toBeNull();
    expect(poundsToPence(null)).toBeNull();
    expect(poundsToPence(undefined)).toBeNull();
    expect(poundsToPence('not-a-number')).toBeNull();
    expect(poundsToPence(-50)).toBe(0);
  });

  it('round-trips via penceToPounds', () => {
    expect(penceToPounds(123450)).toBe(1234.5);
    expect(penceToPounds(null)).toBeNull();
  });
});

describe('coerceValuePence', () => {
  it('accepts null/absent as null', () => {
    expect(coerceValuePence(undefined)).toEqual({ ok: true, value: null });
    expect(coerceValuePence(null)).toEqual({ ok: true, value: null });
    expect(coerceValuePence('')).toEqual({ ok: true, value: null });
  });

  it('accepts non-negative integers (number or numeric string)', () => {
    expect(coerceValuePence(123450)).toEqual({ ok: true, value: 123450 });
    expect(coerceValuePence('500')).toEqual({ ok: true, value: 500 });
    expect(coerceValuePence(0)).toEqual({ ok: true, value: 0 });
  });

  it('rejects non-numbers, fractional pence, negatives and overflow', () => {
    expect(coerceValuePence('abc').ok).toBe(false);
    expect(coerceValuePence(12.5).ok).toBe(false);
    expect(coerceValuePence(-1).ok).toBe(false);
    expect(coerceValuePence(3_000_000_000).ok).toBe(false);
  });
});

describe('sumOpenPipelinePence', () => {
  it('sums GBP open projects and coalesces null values to 0', () => {
    const { pence, nonGbpOpenCount } = sumOpenPipelinePence([
      { status: 'lead', value_pence: 10000, currency: 'GBP' },
      { status: 'proposal', value_pence: null, currency: 'GBP' },
      { status: 'active', value_pence: 5000, currency: 'GBP' },
      { status: 'completed', value_pence: 999999, currency: 'GBP' }, // not open
      { status: 'cancelled', value_pence: 100, currency: 'GBP' }, // not open
    ]);
    expect(pence).toBe(15000);
    expect(nonGbpOpenCount).toBe(0);
  });

  it('excludes non-GBP open projects and counts them separately', () => {
    const { pence, nonGbpOpenCount } = sumOpenPipelinePence([
      { status: 'active', value_pence: 10000, currency: 'GBP' },
      { status: 'active', value_pence: 99999, currency: 'USD' },
      { status: 'lead', value_pence: 5000, currency: null }, // null currency treated as GBP
    ]);
    expect(pence).toBe(15000);
    expect(nonGbpOpenCount).toBe(1);
  });
});

describe('enquiryToClientPrefill', () => {
  it('lowercases email, keeps company, fixes source to enquiry', () => {
    expect(
      enquiryToClientPrefill({ name: '  Ada Lovelace ', company: ' Analytical Ltd ', email: 'Ada@Example.COM' }),
    ).toEqual({
      name: 'Ada Lovelace',
      company: 'Analytical Ltd',
      email: 'ada@example.com',
      source: 'enquiry',
    });
  });

  it('nulls empty company/email and falls back to Unknown for a blank name', () => {
    expect(enquiryToClientPrefill({ name: '', company: '', email: '' })).toEqual({
      name: 'Unknown',
      company: null,
      email: null,
      source: 'enquiry',
    });
  });
});

describe('primitive validators', () => {
  it('validates email format and length', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('nope')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail(42)).toBe(false);
    expect(isValidEmail(`${'a'.repeat(320)}@b.co`)).toBe(false);
  });

  it('normalises email', () => {
    expect(normaliseEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
  });

  it('validates uuids', () => {
    expect(isUuid(UUID)).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('123')).toBe(false);
    expect(isUuid(null)).toBe(false);
  });

  it('validates ISO dates and rejects rollovers', () => {
    expect(isIsoDate('2026-07-14')).toBe(true);
    expect(isIsoDate('2026-02-31')).toBe(false);
    expect(isIsoDate('2026/07/14')).toBe(false);
    expect(isIsoDate('14-07-2026')).toBe(false);
    expect(isIsoDate('')).toBe(false);
  });

  it('validates enums', () => {
    expect(isClientStatus('lead')).toBe(true);
    expect(isClientStatus('nope')).toBe(false);
    expect(isClientSource('enquiry')).toBe(true);
    expect(isClientSource('spam')).toBe(false);
    expect(isProjectStatus('on_hold')).toBe(true);
    expect(isProjectStatus('done')).toBe(false);
    expect(isOpenProjectStatus('active')).toBe(true);
    expect(isOpenProjectStatus('completed')).toBe(false);
  });
});

describe('deriveCompletedAt', () => {
  const now = new Date('2026-07-14T09:00:00.000Z');
  it('sets a timestamp when status becomes completed', () => {
    expect(deriveCompletedAt('completed', now)).toBe('2026-07-14T09:00:00.000Z');
  });
  it('clears it for any other status', () => {
    expect(deriveCompletedAt('active', now)).toBeNull();
    expect(deriveCompletedAt('cancelled', now)).toBeNull();
  });
  it('leaves it untouched when status is absent', () => {
    expect(deriveCompletedAt(undefined, now)).toBeUndefined();
  });
});

describe('parseClientCreate', () => {
  it('accepts a valid client and lowercases the email', () => {
    const r = parseClientCreate({ name: ' Ada ', email: 'ADA@EXAMPLE.com', company: 'X' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.name).toBe('Ada');
      expect(r.value.email).toBe('ada@example.com');
      expect(r.value.status).toBe('lead');
      expect(r.value.source).toBe('direct');
    }
  });

  it('rejects a missing name, invalid enum and invalid email', () => {
    expect(parseClientCreate({}).ok).toBe(false);
    expect(parseClientCreate({ name: 'A', status: 'vip' }).ok).toBe(false);
    expect(parseClientCreate({ name: 'A', source: 'nope' }).ok).toBe(false);
    expect(parseClientCreate({ name: 'A', email: 'bad' }).ok).toBe(false);
  });

  it('ignores unexpected/server-owned fields (mass-assignment guard)', () => {
    const r = parseClientCreate({
      name: 'Ada',
      id: 'attacker-supplied',
      created_at: '1999-01-01',
      updated_at: '1999-01-01',
      is_admin: true,
      client_id: UUID,
    } as Record<string, unknown>);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.value).sort()).toEqual(
        ['company', 'email', 'name', 'phone', 'source', 'status', 'summary', 'website'].sort(),
      );
      expect((r.value as Record<string, unknown>).id).toBeUndefined();
      expect((r.value as Record<string, unknown>).is_admin).toBeUndefined();
    }
  });
});

describe('parseClientUpdate', () => {
  it('applies only provided fields and can clear the email', () => {
    const r = parseClientUpdate({ status: 'active', email: '' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ status: 'active', email: null });
  });

  it('rejects a blanked name, invalid status and empty payload', () => {
    expect(parseClientUpdate({ name: '   ' }).ok).toBe(false);
    expect(parseClientUpdate({ status: 'nope' }).ok).toBe(false);
    expect(parseClientUpdate({}).ok).toBe(false);
  });

  it('never writes server-owned fields', () => {
    const r = parseClientUpdate({ name: 'New', id: 'x', updated_at: 'y' } as Record<string, unknown>);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ name: 'New' });
  });
});

describe('parseProjectCreate', () => {
  it('accepts a valid project', () => {
    const r = parseProjectCreate({
      client_id: UUID,
      name: 'Website',
      value_pence: 500000,
      status: 'proposal',
      due_date: '2026-08-01',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.client_id).toBe(UUID);
      expect(r.value.value_pence).toBe(500000);
      expect(r.value.currency).toBe('GBP');
      expect((r.value as Record<string, unknown>).completed_at).toBeUndefined();
    }
  });

  it('rejects a bad client_id, missing name, bad enum, bad date and bad value', () => {
    expect(parseProjectCreate({ client_id: 'nope', name: 'X' }).ok).toBe(false);
    expect(parseProjectCreate({ client_id: UUID }).ok).toBe(false);
    expect(parseProjectCreate({ client_id: UUID, name: 'X', status: 'wip' }).ok).toBe(false);
    expect(parseProjectCreate({ client_id: UUID, name: 'X', due_date: '31/12/2026' }).ok).toBe(false);
    expect(parseProjectCreate({ client_id: UUID, name: 'X', value_pence: -5 }).ok).toBe(false);
  });

  it('ignores server-owned fields including completed_at', () => {
    const r = parseProjectCreate({
      client_id: UUID,
      name: 'X',
      completed_at: '2000-01-01',
      id: 'evil',
    } as Record<string, unknown>);
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.value as Record<string, unknown>).completed_at).toBeUndefined();
  });
});

describe('parseProjectUpdate', () => {
  it('never reparents via client_id', () => {
    const r = parseProjectUpdate({ name: 'Renamed', client_id: UUID2 } as Record<string, unknown>);
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.value as Record<string, unknown>).client_id).toBeUndefined();
  });

  it('rejects an empty payload and invalid status', () => {
    expect(parseProjectUpdate({}).ok).toBe(false);
    expect(parseProjectUpdate({ status: 'nope' }).ok).toBe(false);
  });
});

describe('parseNoteCreate', () => {
  it('accepts a note scoped to a client', () => {
    const r = parseNoteCreate({ client_id: UUID, body: '  Called them  ' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ body: 'Called them', client_id: UUID, project_id: null });
  });

  it('requires a body and at least one of client_id/project_id, both valid uuids', () => {
    expect(parseNoteCreate({ client_id: UUID }).ok).toBe(false);
    expect(parseNoteCreate({ body: 'hi' }).ok).toBe(false);
    expect(parseNoteCreate({ body: 'hi', client_id: 'bad' }).ok).toBe(false);
    expect(parseNoteCreate({ body: 'hi', project_id: 'bad' }).ok).toBe(false);
  });
});
