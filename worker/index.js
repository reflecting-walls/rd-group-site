// Cloudflare Worker: serves the static site from dist/ and handles the estimate form.
// POST /api/estimate emails the request through Cloudflare Email Routing (send_email binding),
// so no third-party form service is involved. Recipient and sender are set in wrangler.jsonc.
import { EmailMessage } from 'cloudflare:email';

const FIELDS = { name: 120, phone: 40, email: 200, zip: 12, project: 80, message: 4000, page: 200 };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/estimate') return estimate(request, env, url);
    return env.ASSETS.fetch(request);
  },
};

async function estimate(request, env, url) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const origin = request.headers.get('Origin');
  if (origin && new URL(origin).host !== url.host) return json({ error: 'Forbidden' }, 403);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid request' }, 400); }
  if (body.website) return json({ ok: true }); // honeypot: bots fill the hidden field

  const d = {};
  for (const [k, max] of Object.entries(FIELDS)) d[k] = String(body[k] ?? '').trim().slice(0, max);
  if (!d.name || !d.phone) return json({ error: 'Name and phone are required' }, 400);

  const to = env.ESTIMATE_TO, from = env.ESTIMATE_FROM;
  const replyTo = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(d.email) ? d.email : '';
  const text = [
    `New estimate request from ${url.host}`,
    '',
    `Name:    ${d.name}`,
    `Phone:   ${d.phone}`,
    `Email:   ${d.email || '(not given)'}`,
    `ZIP:     ${d.zip || '(not given)'}`,
    `Project: ${d.project || '(not given)'}`,
    '',
    'Details:',
    d.message || '(none)',
    '',
    `Sent from ${url.origin}${d.page || '/'}`,
  ].join('\r\n');

  const raw = [
    `From: RD Group Website <${from}>`,
    `To: <${to}>`,
    ...(replyTo ? [`Reply-To: ${encodeWord(d.name)} <${replyTo}>`] : []),
    `Subject: ${encodeWord(`Estimate request: ${d.name} (${d.project || 'project'})`)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${from.split('@')[1]}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64(text).replace(/.{76}/g, '$&\r\n'),
  ].join('\r\n');

  try {
    await env.EMAIL.send(new EmailMessage(from, to, raw));
  } catch (e) {
    console.error('estimate email failed', e);
    return json({ error: 'Could not send' }, 502);
  }
  return json({ ok: true });
}

function base64(s) {
  let bin = '';
  for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b);
  return btoa(bin);
}
const encodeWord = (s) => `=?UTF-8?B?${base64(s.replace(/[\r\n]+/g, ' '))}?=`;
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
