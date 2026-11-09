// Fonction Netlify : POST /api/chat  { messages } — même logique que api/chat.js (Vercel)
import { handleChatRequest } from '../../server/chatbot.js'
import { jsonFunction } from '../shared/adapter.mjs'

export default jsonFunction(handleChatRequest)
