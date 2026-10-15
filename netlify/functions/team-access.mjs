// Owner-only: create, reset, link and remove WholesaleOS logins.
// The browser sends the signed-in user's token; we check they're an owner, then use the
// SUPABASE_SERVICE_ROLE_KEY (set in Netlify, never sent to the browser) to manage logins.
const json = (body, status=200) => new Response(JSON.stringify(body), { status, headers:{ 'content-type':'application/json', 'cache-control':'no-store' } })
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const UUID = /^[0-9a-f-]{36}$/i

export default async (req) => {
  if(req.method!=='POST') return json({ ok:false, error:'POST only' }, 405)
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/,'')
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  if(!url || !service) return json({ ok:false, error:'Logins can\'t be managed yet: add SUPABASE_SERVICE_ROLE_KEY in Netlify → Site configuration → Environment variables, then redeploy.' }, 500)
  // New-style secret keys (sb_secret_…) go in the apikey header only; legacy JWT keys also go in Authorization.
  const svc = { apikey:service, 'content-type':'application/json', ...(service.startsWith('eyJ') ? { Authorization:'Bearer '+service } : {}) }
  const call = (path, opt={}) => fetch(url+path, { ...opt, headers:{ ...svc, ...(opt.headers||{}) } })

  // 1) who is asking?
  const token = (req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'')
  if(!token) return json({ ok:false, error:'Please sign in again.' }, 401)
  const who = await fetch(url+'/auth/v1/user', { headers:{ apikey:anon||service, Authorization:'Bearer '+token } })
  if(!who.ok) return json({ ok:false, error:'Your session expired — sign out and back in.' }, 401)
  const me = await who.json()
  const mine = await call('/rest/v1/crm_access?select=role&user_id=eq.'+me.id)
  const myRole = mine.ok ? ((await mine.json())[0]||{}).role : null
  if(myRole!=='owner') return json({ ok:false, error:'Only an owner can manage logins.' }, 403)

  let b; try{ b = await req.json() }catch{ return json({ ok:false, error:'Bad request' }, 400) }
  const role = b.role==='owner' ? 'owner' : 'va'
  const member_id = Number.isInteger(b.member_id) ? b.member_id : null
  try{
    if(b.action==='create'){
      const email = String(b.email||'').trim().toLowerCase()
      if(!EMAIL.test(email)) return json({ ok:false, error:'Enter a valid email.' }, 400)
      if(String(b.password||'').length<8) return json({ ok:false, error:'Password needs at least 8 characters.' }, 400)
      let id = null, existed = false
      const made = await call('/auth/v1/admin/users', { method:'POST', body:JSON.stringify({ email, password:b.password, email_confirm:true }) })
      if(made.ok) id = (await made.json()).id
      else {
        // already has a Supabase login -> find it, set the new password, give access
        for(let page=1; page<=20 && !id; page++){
          const r = await call('/auth/v1/admin/users?page='+page+'&per_page=200'); if(!r.ok) break
          const users = (await r.json()).users||[]
          const u = users.find(x=>String(x.email||'').toLowerCase()===email); if(u) id = u.id
          if(users.length<200) break
        }
        if(!id) return json({ ok:false, error:'Couldn\'t create that login: '+(await made.text()).slice(0,200) }, 400)
        existed = true
        await call('/auth/v1/admin/users/'+id, { method:'PUT', body:JSON.stringify({ password:b.password, email_confirm:true }) })
      }
      const up = await call('/rest/v1/crm_access?on_conflict=user_id', { method:'POST', headers:{ Prefer:'resolution=merge-duplicates' }, body:JSON.stringify({ user_id:id, email, role, member_id:role==='va'?member_id:null }) })
      if(!up.ok) throw new Error(await up.text())
      return json({ ok:true, user_id:id, existed })
    }
    if(!UUID.test(String(b.user_id||''))) return json({ ok:false, error:'Unknown login.' }, 400)
    if(b.action==='reset'){
      if(String(b.password||'').length<8) return json({ ok:false, error:'Password needs at least 8 characters.' }, 400)
      const r = await call('/auth/v1/admin/users/'+b.user_id, { method:'PUT', body:JSON.stringify({ password:b.password }) })
      if(!r.ok) throw new Error(await r.text())
      return json({ ok:true })
    }
    if(b.action==='link'){
      const r = await call('/rest/v1/crm_access?user_id=eq.'+b.user_id, { method:'PATCH', body:JSON.stringify({ member_id }) })
      if(!r.ok) throw new Error(await r.text())
      return json({ ok:true })
    }
    if(b.action==='remove'){
      if(b.user_id===me.id) return json({ ok:false, error:'You can\'t remove your own login.' }, 400)
      const d = await call('/rest/v1/crm_access?user_id=eq.'+b.user_id, { method:'DELETE' })
      if(!d.ok) throw new Error(await d.text())
      await call('/auth/v1/admin/users/'+b.user_id, { method:'DELETE' })   // signs them out everywhere
      return json({ ok:true })
    }
    return json({ ok:false, error:'Unknown action.' }, 400)
  }catch(e){
    console.log('team-access error', e.message)
    return json({ ok:false, error:'Something went wrong: '+String(e.message).slice(0,200) }, 500)
  }
}
