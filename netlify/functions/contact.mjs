// Fonction Netlify : POST /api/contact  { name, email, subject, message } — même logique que api/contact.js (Vercel)
import { handleContactRequest } from '../../server/contact.js'
import { jsonFunction } from '../shared/adapter.mjs'

export default jsonFunction(handleContactRequest)
