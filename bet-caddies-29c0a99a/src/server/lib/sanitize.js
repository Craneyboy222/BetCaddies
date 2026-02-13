import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';

const window = new JSDOM('').window;
const purify = DOMPurify(window);

/** Strip ALL HTML, return plain text */
export function sanitizeText(input) {
  if (typeof input !== 'string') return input;
  return purify.sanitize(input, { ALLOWED_TAGS: [] });
}

const EMAIL_ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr', 'div', 'span',
  'strong', 'b', 'em', 'i', 'u',
  'ul', 'ol', 'li',
  'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'blockquote', 'pre', 'code',
];

const EMAIL_ALLOWED_ATTRS = [
  'href', 'src', 'alt', 'title', 'width', 'height',
  'style', 'class', 'target', 'rel',
  'colspan', 'rowspan', 'align', 'valign',
];

/** Allow safe HTML tags for email templates; strip event handlers and javascript: URIs */
export function sanitizeHtml(input) {
  if (typeof input !== 'string') return input;
  return purify.sanitize(input, {
    ALLOWED_TAGS: EMAIL_ALLOWED_TAGS,
    ALLOWED_ATTR: EMAIL_ALLOWED_ATTRS,
    ALLOW_DATA_ATTR: false,
  });
}

/** Recursively sanitize all string values in an object/array (strips all HTML) */
export function sanitizeJson(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return sanitizeText(value);
  if (Array.isArray(value)) return value.map(sanitizeJson);
  if (typeof value === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = sanitizeJson(v);
    }
    return result;
  }
  return value;
}
