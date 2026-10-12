// Runs once a day on Netlify so the free Supabase database never goes idle long enough to pause.
// Uses the same VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY environment variables as the site build.
export default async () => {
  const url = process.env.VITE_SUPABASE_URL, key = process.env.VITE_SUPABASE_ANON_KEY
  if(!url || !key){ console.log('keep-alive: Supabase env vars missing'); return new Response('missing env', {status:500}) }
  const res = await fetch(url.replace(/\/$/,'')+'/rest/v1/leads?select=id&limit=1', { headers:{ apikey:key, Authorization:'Bearer '+key } })
  console.log('keep-alive: Supabase answered', res.status)
  return new Response('ok '+res.status)
}
export const config = { schedule: '@daily' }
