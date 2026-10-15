// Runs once a day on Netlify so the free Supabase database never goes idle long enough to pause.
// Uses the private service key when set (the database is locked to signed-in users), else the public key.
export default async () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if(!url || !key){ console.log('keep-alive: Supabase env vars missing'); return new Response('missing env', {status:500}) }
  const headers = { apikey:key, ...(key.startsWith('eyJ') ? { Authorization:'Bearer '+key } : {}) }
  const res = await fetch(url.replace(/\/$/,'')+'/rest/v1/leads?select=id&limit=1', { headers })
  console.log('keep-alive: Supabase answered', res.status)
  return new Response('ok '+res.status)
}
export const config = { schedule: '@daily' }
