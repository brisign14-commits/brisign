import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * En local, `vite` ne sert pas le dossier `api/` (c'est Vercel qui le fait en production).
 * Ce petit middleware expose les mêmes routes pendant `npm run dev`.
 */
const ROUTES = {
  '/api/brand-extract': { module: '/server/brandExtract.js', handler: 'handleBrandRequest' },
  '/api/chat': { module: '/server/chatbot.js', handler: 'handleChatRequest' },
  '/api/reply': { module: '/server/reply.js', handler: 'handleReplyRequest' },
  '/api/contact': { module: '/server/contact.js', handler: 'handleContactRequest' },
}

function localApi() {
  return {
    name: 'local-api',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '')
      for (const k of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'MICROLINK_API_KEY', 'GEMINI_API_KEY', 'GMAIL_USER', 'GMAIL_APP_PASSWORD', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'NOTIFY_EMAIL'])
        if (env[k]) process.env[k] = env[k] // toujours la valeur actuelle du fichier (Vite redémarre sans recharger le processus)

      for (const [route, { module, handler }] of Object.entries(ROUTES)) {
        server.middlewares.use(route, async (req, res) => {
          let raw = ''
          for await (const chunk of req) {
            raw += chunk
            if (raw.length > 20000) break
          }
          let body = null
          try {
            body = JSON.parse(raw || 'null')
          } catch {
            /* corps invalide */
          }
          const mod = await server.ssrLoadModule(module)
          const { status, json } = await mod[handler]({
            method: req.method,
            authorization: req.headers.authorization,
            body,
            ip: req.socket?.remoteAddress,
            origin: 'https://portfolio-brillant-dev.vercel.app', // lien du site dans les mails envoyés en local
          })
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(json))
        })
      }
    },
  }
}

/**
 * Adresse publique du site dans les balises d'aperçu de index.html (%OG_ORIGIN%).
 * Sur Vercel, VERCEL_PROJECT_PRODUCTION_URL est fournie au build ; SITE_URL permet de la forcer
 * (domaine personnalisé). Sans adresse connue, les lignes concernées sont retirées.
 */
function ogOrigin() {
  return {
    name: 'og-origin',
    transformIndexHtml(html) {
      const raw = process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || ''
      const origin = raw ? (/^https?:\/\//.test(raw) ? raw : `https://${raw}`).replace(/\/+$/, '') : ''
      return origin ? html.replaceAll('%OG_ORIGIN%', origin) : html.replace(/^.*(%OG_ORIGIN%|og:image).*\r?\n/gm, '')
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localApi(), ogOrigin()],
})
