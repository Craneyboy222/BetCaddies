import { describe, it, expect } from 'vitest';
import { sanitizeText, sanitizeHtml, sanitizeJson } from '../../server/lib/sanitize.js';

describe('sanitizeText', () => {
  it('strips all HTML tags', () => {
    expect(sanitizeText('<script>alert("xss")</script>Hello')).toBe('Hello');
  });

  it('strips inline event handlers', () => {
    expect(sanitizeText('<div onclick="evil()">text</div>')).toBe('text');
  });

  it('passes through plain text unchanged', () => {
    expect(sanitizeText('Hello World')).toBe('Hello World');
  });

  it('returns non-string input as-is', () => {
    expect(sanitizeText(42)).toBe(42);
    expect(sanitizeText(null)).toBe(null);
    expect(sanitizeText(undefined)).toBe(undefined);
  });
});

describe('sanitizeHtml', () => {
  it('allows safe HTML tags', () => {
    const input = '<p>Hello <b>World</b></p>';
    expect(sanitizeHtml(input)).toBe('<p>Hello <b>World</b></p>');
  });

  it('strips script tags', () => {
    const input = '<p>Safe</p><script>evil()</script>';
    expect(sanitizeHtml(input)).toBe('<p>Safe</p>');
  });

  it('strips event handlers from allowed tags', () => {
    const input = '<p onclick="evil()">Safe <b>text</b></p>';
    expect(sanitizeHtml(input)).toBe('<p>Safe <b>text</b></p>');
  });

  it('strips javascript: URIs from links', () => {
    const result = sanitizeHtml('<a href="javascript:void(0)">Link</a>');
    expect(result).not.toContain('javascript:');
  });

  it('allows safe href attributes', () => {
    const input = '<a href="https://example.com" target="_blank">Link</a>';
    expect(sanitizeHtml(input)).toContain('href="https://example.com"');
  });

  it('allows table elements', () => {
    const input = '<table><tr><td>Cell</td></tr></table>';
    expect(sanitizeHtml(input)).toBe('<table><tbody><tr><td>Cell</td></tr></tbody></table>');
  });

  it('strips data attributes', () => {
    const input = '<div data-evil="payload">text</div>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('data-evil');
  });

  it('returns non-string input as-is', () => {
    expect(sanitizeHtml(123)).toBe(123);
  });
});

describe('sanitizeJson', () => {
  it('sanitizes string values in flat objects', () => {
    const input = { title: '<script>x</script>Title', count: 5 };
    const result = sanitizeJson(input);
    expect(result.title).toBe('Title');
    expect(result.count).toBe(5);
  });

  it('sanitizes nested objects', () => {
    const input = {
      hero: {
        title: '<img onerror="x" src="x">Heading',
        subtitle: 'Clean'
      }
    };
    const result = sanitizeJson(input);
    expect(result.hero.title).toBe('Heading');
    expect(result.hero.subtitle).toBe('Clean');
  });

  it('sanitizes arrays', () => {
    const input = [
      { body: '<script>alert(1)</script>Text' },
      { body: 'Safe text' }
    ];
    const result = sanitizeJson(input);
    expect(result[0].body).toBe('Text');
    expect(result[1].body).toBe('Safe text');
  });

  it('preserves null and undefined', () => {
    expect(sanitizeJson(null)).toBe(null);
    expect(sanitizeJson(undefined)).toBe(undefined);
  });

  it('preserves numbers and booleans', () => {
    expect(sanitizeJson(42)).toBe(42);
    expect(sanitizeJson(true)).toBe(true);
  });

  it('handles deeply nested structures', () => {
    const input = {
      blocks: [
        {
          type: 'text',
          data: {
            items: [{ content: '<b onmouseover="x">Bold</b>' }]
          }
        }
      ]
    };
    const result = sanitizeJson(input);
    expect(result.blocks[0].data.items[0].content).toBe('Bold');
  });
});
