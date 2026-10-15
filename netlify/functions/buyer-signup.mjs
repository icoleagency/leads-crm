// Public "Join my buyers list" form posts here (the /join page).
// Validates the answers, then adds the buyer — or updates them if the same phone/email is already on your list.
// Uses SUPABASE_SERVICE_ROLE_KEY when it's set in Netlify (so the database can later be locked down),
// otherwise the same VITE_SUPABASE_* variables as the site.
const TYPES = ['Flipper','Landlord / BRRRR','Builder','Wholetailer','Fund / institutional','Other']
const PROPS = ['Single family','Multi-family','Condo / townhouse','Land','Mobile home']
const REHAB = ['Light','Medium','Heavy','Teardown']
const FIN = ['Cash','Hard money','Private money','Conventional']
const DEALS = { '0':0, '1-2':2, '3-5':4, '6-10':8, '10+':12 }
const json = (body, status=200) => new Response(JSON.stringify(body), { status, headers:{ 'content-type':'application/json' } })
const str = (v, n=120) => String(v??'').replace(/\s+/g,' ').trim().slice(0,n)
const list = (v, allowed, n=12) => (Array.isArray(v)?v:String(v||'').split(/[,;]/)).map(x=>str(x,60)).filter(Boolean).filter(x=>!allowed||allowed.includes(x)).slice(0,n)
const phone10 = p => { const d = String(p||'').replace(/\D/g,''); const t = d.length===11 && d[0]==='1' ? d.slice(1) : d; return t.length===10 ? t : null }
const money = v => { const n = Number(String(v??'').replace(/[$,\s]/g,'')); return Number.isFinite(n) && n>0 && n<100000000 ? Math.round(n) : null }

export default async (req) => {
  if(req.method!=='POST') return json({ ok:false, error:'POST only' }, 405)
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/,'')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if(!url || !key) return json({ ok:false, error:'The sign-up form is not connected to the database yet.' }, 500)
  let b; try{ b = await req.json() }catch{ return json({ ok:false, error:'Bad request' }, 400) }
  if(b.website) return json({ ok:true })                       // honeypot: bots fill hidden fields
  const name = str(b.name, 80), email = str(b.email, 120).toLowerCase(), ph = phone10(b.phone)
  if(name.length<2) return json({ ok:false, error:'Please add your name.' }, 400)
  if(!ph && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok:false, error:'Please add a valid phone number or email.' }, 400)
  const markets = list(b.markets, null, 15)
  const dealsLabel = Object.keys(DEALS).includes(b.deals) ? b.deals : null
  const profile = {
    signup:true, signup_at:new Date().toISOString(), signup_source:str(b.src,40)||null,
    deals_reported:dealsLabel?DEALS[dealsLabel]:null, deals_reported_label:dealsLabel?dealsLabel+' deals in the last 12 months':null,
    close_days:[7,14,21,30,45].includes(Number(b.close_days))?Number(b.close_days):null,
    pof_ready:!!b.pof, sms_ok:!!b.sms_ok, wants:str(b.notes,500)||null,
  }
  const row = {
    name, company:str(b.company,80)||null, phone:ph, email:email||null,
    buyer_type: TYPES.includes(b.buyer_type) ? b.buyer_type : null,
    markets, property_types:list(b.property_types, PROPS), rehab:list(b.rehab, REHAB),
    min_price:money(b.min_price), max_price:money(b.max_price),
    financing: FIN.includes(b.financing) ? b.financing : null,
    status:'active', source:'Sign-up form'+(profile.signup_source?' · '+profile.signup_source:''), updated_at:new Date().toISOString(),
  }
  const H = { apikey:key, Authorization:'Bearer '+key, 'content-type':'application/json' }
  const api = (path, opt={}) => fetch(url+'/rest/v1/'+path, { ...opt, headers:{ ...H, ...(opt.headers||{}) } })
  try{
    // already on the list? (same phone or email) -> update instead of adding a duplicate
    const ors = [ph && 'phone.eq.'+ph, email && 'email.eq.'+encodeURIComponent(email)].filter(Boolean).join(',')
    const found = await api('buyers?select=id,tags,profile,notes&or=('+ors+')&limit=1')
    const prev = found.ok ? (await found.json())[0] : null
    const tags = [...new Set([...(prev?.tags||[]), 'signed up'])]
    const notes = profile.wants ? ((prev?.notes ? prev.notes+'\n' : '')+'Sign-up: '+profile.wants).slice(0,2000) : prev?.notes
    const full = { ...row, tags, notes:notes||null, profile:{ ...(prev?.profile||{}), ...profile } }
    let res = prev
      ? await api('buyers?id=eq.'+prev.id, { method:'PATCH', body:JSON.stringify(full) })
      : await api('buyers', { method:'POST', body:JSON.stringify(full) })
    if(!res.ok){
      const t = await res.text()
      if(!/profile/.test(t)) throw new Error(t)
      {                                   // database not upgraded yet: save without the extra answers
        const { profile:_p, ...rest } = full
        rest.notes = [rest.notes, profile.deals_reported_label, profile.close_days?'Closes in '+profile.close_days+' days':null, profile.pof_ready?'Has proof of funds':null].filter(Boolean).join(' · ')
        res = prev ? await api('buyers?id=eq.'+prev.id, { method:'PATCH', body:JSON.stringify(rest) }) : await api('buyers', { method:'POST', body:JSON.stringify(rest) })
      }
      if(!res.ok) throw new Error(await res.text())
    }
    return json({ ok:true, updated:!!prev })
  }catch(e){
    console.log('buyer-signup error', e.message)
    return json({ ok:false, error:"Couldn't save right now — please try again in a minute." }, 500)
  }
}
