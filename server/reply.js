/**
 * Mails envoyés depuis ta propre adresse Gmail (réponse manuelle + réponse automatique).
 *
 *  - Envoi par le SMTP de Gmail avec un « mot de passe d'application » :
 *      GMAIL_USER=ton.adresse@gmail.com
 *      GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
 *    Le mail part de ton adresse et apparaît dans tes « Messages envoyés ».
 *  - En-tête du mail : ta photo de profil (jointe au mail, donc visible même si la messagerie
 *    bloque les images externes) et ton nom.
 *  - Réponse manuelle (/api/reply) : réservée aux administrateurs, et le destinataire est
 *    TOUJOURS l'auteur d'un message existant (la route ne peut pas servir à écrire à n'importe qui).
 */
import nodemailer from 'nodemailer'
import { HttpError, assertAdmin } from './brandExtract.js'

const env = (k) => process.env[k] || process.env[`VITE_${k}`]

async function rest(path, token) {
  const r = await fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
    headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: `Bearer ${token}` },
  })
  if (!r.ok) throw new HttpError(502, 'Lecture Supabase impossible.')
  return r.json()
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const paragraphs = (s) =>
  esc(s)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${p.replace(/\n/g, '<br>')}</p>`)
    .join('')

export function emailHtml({ profile, text, original, siteUrl, hasAvatar }) {
  const name = esc(profile.full_name || 'Brillant')
  const avatar = hasAvatar
    ? `<img src="cid:avatar" width="56" height="56" alt="${name}" style="display:block;width:56px;height:56px;border-radius:50%;object-fit:cover">`
    : `<div style="width:56px;height:56px;border-radius:50%;background:#FF5A1F;color:#fff;font:600 24px/56px Arial,sans-serif;text-align:center">${name.charAt(0)}</div>`
  const quote = original
    ? `<tr><td style="padding:20px 28px 28px;background:#faf8f5;border-top:1px solid #eeeae4">
    <div style="font-size:12px;color:#77716a;margin-bottom:8px">Le ${esc(original.date)}, ${esc(original.name)} a écrit :</div>
    <div style="font-size:13px;line-height:1.55;color:#55504a;border-left:3px solid #e2ddd5;padding-left:12px">${esc(original.message).replace(/\n/g, '<br>')}</div>
  </td></tr>`
    : ''
  return `<!doctype html><html><body style="margin:0;background:#f4f2ee;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
  <tr><td style="padding:24px 28px;border-bottom:1px solid #eeeae4">
    <table role="presentation" cellspacing="0" cellpadding="0"><tr>
      <td style="padding-right:14px">${avatar}</td>
      <td><div style="font-size:17px;font-weight:bold">${name}</div>
          <div style="font-size:13px;color:#77716a;margin-top:2px">${esc(profile.role || '')}</div></td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:28px;font-size:15px;line-height:1.6">${paragraphs(text)}
    <p style="margin:24px 0 0">${name}${siteUrl ? `<br><a href="${esc(siteUrl)}" style="color:#FF5A1F;text-decoration:none">${esc(siteUrl.replace(/^https?:\/\//, ''))}</a>` : ''}</p>
  </td></tr>
  ${quote}
</table></td></tr></table></body></html>`
}

export const gmailConfigured = () => Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)

/** Envoie un mail depuis le Gmail configuré, avec photo + nom en en-tête. */
export async function sendBrandedMail({ profile = {}, to, subject, text, original = null, origin }) {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '')
  if (!user || !pass) throw new HttpError(503, 'Envoi non configuré : ajoute GMAIL_USER et GMAIL_APP_PASSWORD dans les variables Vercel.')
  const hasAvatar = /^https:\/\//.test(profile.avatar_url || '')
  const fromName = (profile.full_name || 'Brillant').replace(/["<>]/g, '')
  const quoted = original
    ? `\n\nLe ${original.date}, ${original.name} a écrit :\n${original.message.split('\n').map((l) => `> ${l}`).join('\n')}`
    : ''
  await nodemailer.createTransport({ service: 'gmail', auth: { user, pass } }).sendMail({
    from: { name: fromName, address: user },
    to,
    replyTo: user,
    subject,
    text: `${text}\n\n${fromName}${origin ? `\n${origin}` : ''}${quoted}`,
    html: emailHtml({ profile, text, original, siteUrl: origin, hasAvatar }),
    attachments: hasAvatar ? [{ path: profile.avatar_url, cid: 'avatar', contentDisposition: 'inline' }] : [],
  })
}

export async function handleReplyRequest({ method, authorization, body, origin }) {
  if (method !== 'POST') return { status: 405, json: { error: 'Méthode non autorisée.' } }
  try {
    await assertAdmin(authorization)
    const id = String(body?.messageId || '')
    const text = String(body?.text || '').trim()
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, 'Message introuvable.')
    if (!text) throw new HttpError(400, 'Écris ta réponse.')
    if (text.length > 10000) throw new HttpError(400, 'Réponse trop longue (10 000 caractères max).')

    const token = /^Bearer\s+(.+)$/i.exec(authorization)[1]
    const [[msg], [profile = {}]] = await Promise.all([
      rest(`messages?id=eq.${id}&select=name,email,subject,message,created_at`, token),
      rest('profile?select=full_name,role,avatar_url&limit=1', token),
    ])
    if (!msg) throw new HttpError(404, 'Message introuvable.')

    const date = new Date(msg.created_at).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Indian/Antananarivo' })
    await sendBrandedMail({
      profile,
      to: { name: msg.name, address: msg.email },
      subject: `Re: ${msg.subject || 'Ton message'}`.slice(0, 200),
      text,
      original: { name: msg.name, message: msg.message, date },
      origin,
    })
    return { status: 200, json: { ok: true, to: msg.email } }
  } catch (e) {
    if (e instanceof HttpError) return { status: e.status, json: { error: e.message } }
    if (e?.code === 'EAUTH') return { status: 502, json: { error: 'Gmail refuse la connexion : vérifie GMAIL_USER et le mot de passe d’application.' } }
    console.error('[reply]', e)
    return { status: 502, json: { error: 'L’envoi a échoué. Réessaie dans un instant.' } }
  }
}
