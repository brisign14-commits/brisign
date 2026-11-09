// Fonction Netlify : POST /api/brand-extract  { url }  (réservée aux admins) — même logique que api/brand-extract.js (Vercel)
import { handleBrandRequest } from '../../server/brandExtract.js'
import { jsonFunction } from '../shared/adapter.mjs'

export default jsonFunction(handleBrandRequest)
