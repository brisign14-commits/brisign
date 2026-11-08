/**
 * Formulaire de contact : enregistre le message, puis envoie la réponse automatique
 * si elle est activée et que l'admin est hors ligne (voir supabase/migrations/004_auto_reply.sql).
 *
 * Anti-abus : la réponse automatique ne recopie jamais le texte du visiteur (impossible de
 * s'en servir pour relayer du spam), limite par adresse IP et une seule réponse par adresse
 * email toutes les 12 h (au mieux, par instance serveur).
 */
import { HttpError } from './brandExtract.js'
import nodemailer from 'nodemailer'
import { gmailConfigured, sendBrandedMail } from './reply.js'

const env = (k) => process.env[k] || process.env[`VITE_${k}`]
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const recent = new Map() // clé → horodatages
function tooMany(key, max, windowMs) {
  const now = Date.now()
  const list = (recent.get(key) || []).filter((t) => now - t < windowMs)
  if (list.length >= max) return true
  list.push(now)
  recent.set(key, list)
  if (recent.size > 5000) recent.clear()
  return false
}

async function supa(path, init = {}) {
  const key = env('SUPABASE_ANON_KEY')
  return fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...init.headers },
  })
}

/** Prénom affichable : court, sans lien ni caractère exotique. */
const firstName = (name) =>
  String(name)
    .replace(/https?:\/\/\S+|www\.\S+|\S+\.\S{2,}\/\S*/gi, '')
    .replace(/[^\p{L}\p{M}' -]/gu, '')
    .trim()
    .split(/\s+/)[0]
    ?.slice(0, 30) || ''

async function sendAutoReply({ name, email, origin }) {
  if (!gmailConfigured()) return false
  if (tooMany(`mail:${email.toLowerCase()}`, 1, 12 * 3600 * 1000)) return false
  const r = await supa('rpc/auto_reply_due', { method: 'POST', body: '{}' })
  if (!r.ok) return false // migration 004 pas encore exécutée
  const [due] = await r.json()
  if (!due) return false // désactivée, ou tu es en ligne
  const [profile = {}] = await (await supa('profile?select=full_name,role,avatar_url&limit=1')).json()
  const prenom = firstName(name)
  const text = due.message
    .replace(/\{\s*pr[eé]nom\s*\}/gi, prenom)
    .replace(/\{\s*nom\s*\}/gi, prenom)
    .replace(/Bonjour\s+,/g, 'Bonjour,')
  await sendBrandedMail({ profile, to: { name: prenom || email, address: email }, subject: due.subject, text, origin })
  return true
}

/**
 * Notification Telegram (gratuit, officiel) :
 *   TELEGRAM_BOT_TOKEN=123456:ABC…   (donné par @BotFather)
 *   TELEGRAM_CHAT_ID=987654321       (ton identifiant de discussion)
 */
async function notifyTelegram({ name, email, subject, message, origin }) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim()
  if (!token || !chatId) return false
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
  const text = [
    '📩 <b>Nouveau message sur ton portfolio</b>',
    `De : ${esc(name)} (${esc(email)})`,
    subject ? `Sujet : ${esc(subject)}` : null,
    '',
    esc(message.length > 1500 ? `${message.slice(0, 1500)}…` : message),
  ]
    .filter((l) => l !== null)
    .join('\n')
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10000),
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      ...(origin ? { reply_markup: { inline_keyboard: [[{ text: 'Ouvrir dans l’admin', url: `${origin}/admin-bri/messages` }]] } } : {}),
    }),
  })
  if (!r.ok) throw new Error(`Telegram ${r.status}: ${(await r.text()).slice(0, 160)}`)
  return true
}

/**
 * Notification par mail sur ton Gmail (ou NOTIFY_EMAIL si défini).
 * « Répondre » dans Gmail écrit directement au visiteur (Reply-To).
 */
export async function notifyEmail({ name, email, subject, message, origin }) {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '')
  if (!user || !pass) return false
  const to = process.env.NOTIFY_EMAIL?.trim() || user
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  const admin = origin ? `${origin}/admin-bri/messages` : null
  await nodemailer.createTransport({ service: 'gmail', auth: { user, pass } }).sendMail({
    from: { name: `${name.replace(/["<>]/g, '').slice(0, 60)} via Portfolio`, address: user },
    to,
    replyTo: { name, address: email },
    subject: `📩 ${subject || 'Nouveau message'} — ${name}`.slice(0, 200),
    text: `Nouveau message sur ton portfolio\n\nDe : ${name} <${email}>\n${subject ? `Sujet : ${subject}\n` : ''}\n${message}\n\n— Réponds directement à ce mail pour lui écrire.${admin ? `\nAdmin : ${admin}` : ''}`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;max-width:560px">
  <p style="margin:0 0 4px;font-size:12px;color:#FF5A1F;font-weight:bold;text-transform:uppercase;letter-spacing:.06em">Nouveau message sur ton portfolio</p>
  <p style="margin:0 0 16px"><strong>${esc(name)}</strong> &lt;<a href="mailto:${esc(email)}" style="color:#1a1a1a">${esc(email)}</a>&gt;${subject ? `<br><span style="color:#77716a">Sujet : ${esc(subject)}</span>` : ''}</p>
  <div style="white-space:pre-wrap;background:#f6f4f0;border-radius:12px;padding:16px 18px">${esc(message)}</div>
  <p style="margin:16px 0 0;font-size:13px;color:#77716a">Réponds directement à ce mail pour lui écrire${admin ? `, ou <a href="${esc(admin)}" style="color:#FF5A1F">ouvre l’admin</a>` : ''}.</p>
</div>`,
  })
  return true
}

export async function handleContactRequest({ method, body, ip, origin }) {
  if (method !== 'POST') return { status: 405, json: { error: 'Méthode non autorisée.' } }
  try {
    const name = String(body?.name ?? '').trim()
    const email = String(body?.email ?? '').trim()
    const subject = String(body?.subject ?? '').trim()
    const message = String(body?.message ?? '').trim()
    if (body?.website) return { status: 200, json: { ok: true } } // champ piège rempli par un robot
    if (!name || name.length > 120) throw new HttpError(400, 'Indique ton nom.')
    if (!EMAIL.test(email) || email.length > 200) throw new HttpError(400, 'Adresse email invalide.')
    if (subject.length > 200) throw new HttpError(400, 'Sujet trop long.')
    if (!message || message.length > 5000) throw new HttpError(400, 'Écris ton message (5 000 caractères max).')
    if (tooMany(`ip:${ip || 'anon'}`, 5, 10 * 60 * 1000)) throw new HttpError(429, 'Trop de messages envoyés. Réessaie dans quelques minutes.')

    const r = await supa('messages', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ name, email, subject: subject || null, message }),
    })
    if (!r.ok) throw new HttpError(502, 'Le message n’a pas pu être envoyé. Réessaie dans un instant.')

    // Le message est enregistré : notification et réponse automatique ne doivent jamais faire échouer l'envoi
    const [, , autoReplied] = await Promise.all([
      notifyTelegram({ name, email, subject, message, origin }).catch((e) => (console.error('[contact] Telegram :', e.message), false)),
      notifyEmail({ name, email, subject, message, origin }).catch((e) => (console.error('[contact] mail de notification :', e?.code || e?.message), false)),
      sendAutoReply({ name, email, origin }).catch((e) => (console.error('[contact] réponse automatique :', e?.code || e?.message || e), false)),
    ])

    return { status: 200, json: { ok: true, autoReplied } }
  } catch (e) {
    if (e instanceof HttpError) return { status: e.status, json: { error: e.message } }
    console.error('[contact]', e)
    return { status: 502, json: { error: 'Le message n’a pas pu être envoyé. Réessaie dans un instant.' } }
  }
}
