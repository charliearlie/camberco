import { describe, expect, it } from 'vitest';
import { FROM_EMAIL, REPLY_TO, buildDigestBatch, chunk } from './email';

describe('chunk', () => {
  it('splits an array into batches of the given size', () => {
    const items = Array.from({ length: 250 }, (_, i) => i);
    expect(chunk(items, 100).map((b) => b.length)).toEqual([100, 100, 50]);
  });

  it('returns no batches for an empty array', () => {
    expect(chunk([], 100)).toEqual([]);
  });
});

describe('buildDigestBatch', () => {
  const post = {
    title: 'Automate the boring bits',
    slug: 'automate-the-boring-bits',
    description: 'Practical automation for small teams.',
    author: 'Charlie',
  };
  const subs = [
    { email: 'a@example.com', unsubscribe_token: 'tok-a' },
    { email: 'b@example.com', unsubscribe_token: 'tok-b' },
  ];

  it('builds one email per subscriber with from, replyTo and subject set', () => {
    const batch = buildDigestBatch(subs, post);
    expect(batch).toHaveLength(2);
    for (const email of batch) {
      expect(email.from).toBe(FROM_EMAIL);
      expect(email.replyTo).toBe(REPLY_TO);
      expect(email.subject).toBe('New post: Automate the boring bits');
    }
    expect(batch[0].to).toBe('a@example.com');
    expect(batch[1].to).toBe('b@example.com');
  });

  it('sets one-click unsubscribe headers per subscriber', () => {
    const [first] = buildDigestBatch(subs, post);
    expect(first.headers['List-Unsubscribe']).toBe(
      '<https://camberco.co.uk/api/unsubscribe?token=tok-a>',
    );
    expect(first.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });

  it('links to the post and the unsubscribe URL in the body', () => {
    const [first] = buildDigestBatch(subs, post);
    expect(first.html).toContain('https://camberco.co.uk/blog/automate-the-boring-bits"');
    expect(first.html).toContain('https://camberco.co.uk/api/unsubscribe?token=tok-a');
  });
});
