// Shared deal math: buyer profit, stress test, investor price check, and the lock-in guardrail.
// Used by the Deal Analyzer (live) and by the Pipeline / call log (from the saved analysis).

const median = a => { if(!a.length) return 0; const s=[...a].sort((x,y)=>x-y); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2 }
const pctile = (a,p) => { if(!a.length) return 0; const s=[...a].sort((x,y)=>x-y); return s[Math.min(s.length-1, Math.max(0, Math.round((s.length-1)*p)))] }
const money = n => '$'+Math.round(Number(n||0)).toLocaleString()

// ---------- buyer profit ----------
// What a flip buyer makes if they pay `buyerPrice` (your contract price + your fee).
export function buyerProfit({ arv, buyerPrice, rehab, holdMonths=4, holdMonthly=1500 }){
  return arv - buyerPrice - rehab - buyerPrice*0.02 - holdMonths*holdMonthly - arv*0.08
}
export const targetProfit = arv => Math.max(25000, arv*0.10)   // what flippers want
export const floorProfit = arv => Math.max(10000, arv*0.05)     // below this they walk away

// ---------- stress test ----------
// Buyer profit when things go wrong: ARV comes in lower, rehab runs over, it takes longer.
export function stressed(p, { arvDrop=0, rehabOver=0, extraMonths=0 }){
  return buyerProfit({ ...p, arv:p.arv*(1-arvDrop/100), rehab:p.rehab*(1+rehabOver/100), holdMonths:(p.holdMonths||0)+extraMonths })
}
// How far ARV can fall (and rehab can run over) before the buyer's profit drops under the floor.
export function tolerance(p){
  const ok = s => stressed(p, s) >= floorProfit(p.arv*(1-(s.arvDrop||0)/100))
  if(!ok({})) return { arvDrop:0, rehabOver:0, broken:true }
  let a = 0; while(a<40 && ok({ arvDrop:a+0.5 })) a += 0.5
  let r = 0; while(r<200 && ok({ rehabOver:r+5 })) r += 5
  return { arvDrop:a, rehabOver:r, broken:false }
}

// ---------- what investors actually paid nearby ----------
// purchases: [{address, city, zip, county, price, date, type, buyer}] from verified cash buyers (Cash Buyer Finder)
export function investorStats(subject, purchases, { months=12 }={}){
  const cutoff = Date.now() - months*30.4*86400000
  const norm = s => String(s||'').toLowerCase().replace(/\s*county$/,'').trim()
  const seen = new Set()
  const pool = (purchases||[]).filter(p=>{
    const price = Number(p.price); if(!price || price<10000) return false
    if(p.date && new Date(p.date).getTime() < cutoff) return false
    if(/land|lot|vacant/i.test(p.type||'')) return false
    const k = norm(p.address)+'|'+price; if(seen.has(k)) return false; seen.add(k)
    return true
  })
  const scopes = [
    ['zip', subject.zip, p=>String(p.zip||'').slice(0,5)===String(subject.zip||'').slice(0,5)],
    ['city', subject.city, p=>norm(p.city)===norm(subject.city)],
    ['county', subject.county, p=>norm(p.county)===norm(subject.county)],
  ].filter(s=>s[1])
  for(const [scope, label, f] of scopes){
    const list = pool.filter(f)
    if(list.length>=3 || (scope==='county' && list.length)){
      const prices = list.map(p=>Number(p.price))
      return { n:list.length, scope, label:String(label), months, median:median(prices), p25:pctile(prices,0.25), p75:pctile(prices,0.75),
        min:Math.min(...prices), max:Math.max(...prices), list:list.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,12) }
    }
  }
  return { n:0, months }
}

// Every verified purchase on file, tagged with who bought it.
export function allPurchases(buyers){
  const out = []
  for(const b of buyers||[]){ for(const p of ((b.profile&&b.profile.purchases)||[])) out.push({ ...p, buyer:b.company||b.name }) }
  return out
}
// What your own buyers did on past deals near here: offers they made and prices they paid you.
export function yourBuyerHistory(subject, leads, bact){
  const norm = s => String(s||'').toLowerCase().replace(/\s*county$/,'').trim()
  const near = l => (subject.zip && String((l.details||{}).zip||'').slice(0,5)===String(subject.zip).slice(0,5)) || (subject.city && norm(l.city)===norm(subject.city))
  const byId = Object.fromEntries((leads||[]).map(l=>[String(l.id), l]))
  const offers = (bact||[]).filter(a=>a.kind==='offer' && Number(a.amount) && byId[a.lead_id] && near(byId[a.lead_id]) && String(a.lead_id)!==String(subject.id))
  const paid = (leads||[]).filter(l=>String(l.id)!==String(subject.id) && near(l) && Number(((l.details||{}).deal||{}).assign_price))
    .map(l=>({ address:l.address, price:Number(l.details.deal.assign_price), contract:Number(l.details.deal.contract_price)||null }))
  return { offers:offers.map(a=>({ address:byId[a.lead_id].address, price:Number(a.amount), date:a.created_at })), paid }
}

// ---------- the lock-in guardrail ----------
// r = numbers from the analysis; price = what you'd sign with the seller.
// Returns checks [{key,label,status:'green'|'amber'|'red',text}] and an overall verdict.
export function lockCheck(r, price){
  const checks = []
  const add = (key,label,status,text) => checks.push({ key, label, status, text })
  const arv = Number(r && r.arv)||0
  if(!arv){
    add('analysis','Deal analysis','red','No analysis saved for this lead. Run comps in the Deal Analyzer before you lock it.')
    return { checks, overall:'red', title:"Don't lock without numbers" }
  }
  price = Number(price)||0
  if(r.exit==='subto' || r.exit==='sellerfi') return creativeLock(r, price)
  const fee = Number(r.fee)||0, rehab = Number(r.rehab)||0
  const p = { arv, buyerPrice:price+fee, rehab, holdMonths:Number(r.holdMonths)||4, holdMonthly:Number(r.holdMonthly)||1500 }

  // 1. price vs walk-away
  if(!price) add('price','Price vs. your max','amber','Enter the contract price to check it.')
  else if(price<=r.walk) add('price','Price vs. your max','green',money(price)+' is '+money(r.walk-price)+' under your walk-away of '+money(r.walk)+'.')
  else if(price<=r.walk*1.03) add('price','Price vs. your max','amber',money(price)+' is '+money(price-r.walk)+' over your walk-away — your fee shrinks to about '+money(Math.max(0,fee-(price-r.walk)))+'.')
  else add('price','Price vs. your max','red',money(price)+' is '+money(price-r.walk)+' over your walk-away of '+money(r.walk)+'. You will likely have to renegotiate or cut your fee to sell it.')

  // 2. ARV confidence
  const conf = r.confidence
  if(conf==='High') add('arv','ARV confidence','green','High — '+(r.comps||0)+' good comps.')
  else if(conf==='Medium') add('arv','ARV confidence','amber','Medium — '+(r.comps||0)+' comps. Tighten them up if you can.')
  else add('arv','ARV confidence','red',(conf||'Low')+' — the ARV could be off. Add closer, recent comps.')

  // 3. rehab estimate
  if(!rehab) add('rehab','Rehab estimate','red','No rehab estimate. Even "cosmetic" needs a number.')
  else if(r.rehabItemized) add('rehab','Rehab estimate','green',money(rehab)+' from itemized repairs.')
  else add('rehab','Rehab estimate','amber',money(rehab)+' from a $/sqft level — a walkthrough or itemized repairs would be safer.')

  // 4. buyer's profit
  if(price){
    const bp = buyerProfit(p)
    if(bp>=targetProfit(arv)) add('spread',"Buyer's profit",'green','A flipper makes about '+money(bp)+' — easy to sell.')
    else if(bp>=floorProfit(arv)) add('spread',"Buyer's profit",'amber','A flipper makes about '+money(bp)+' — thin. Expect pushback on price.')
    else add('spread',"Buyer's profit",'red','A flipper makes only '+money(bp)+' — most cash buyers will pass.')
  }

  // 5. what investors actually paid
  const inv = r.investor
  if(price && inv && inv.n>=3){
    const bpx = price+fee
    if(bpx<=inv.median) add('investor','Investor prices nearby','green','Your price to buyers ('+money(bpx)+') is at or under the median investors paid in '+inv.label+' ('+money(inv.median)+', '+inv.n+' sales).')
    else if(bpx<=inv.p75) add('investor','Investor prices nearby','amber','Your price to buyers ('+money(bpx)+') is above the median investors paid in '+inv.label+' ('+money(inv.median)+'). Only nicer houses sell for that.')
    else add('investor','Investor prices nearby','red','Your price to buyers ('+money(bpx)+') is above what 3 out of 4 investors paid in '+inv.label+' (75th percentile '+money(inv.p75)+').')
  } else add('investor','Investor prices nearby','amber','Not enough investor sales on file near this house to compare. Load a cash-buyer list for this area in Buyers → Find cash buyers.')

  // 6. stress test
  if(price){
    const t = tolerance(p)
    if(t.broken) add('stress','Room for surprises','red','No room — the buyer is already under a safe profit before anything goes wrong.')
    else if(t.arvDrop>=7) add('stress','Room for surprises','green','Still sells if the ARV comes in '+t.arvDrop+'% low or rehab runs '+t.rehabOver+'% over.')
    else add('stress','Room for surprises','amber','Only works if the ARV holds within '+t.arvDrop+'% and rehab within '+t.rehabOver+'%.')
  }

  // 7. analysis age
  const age = r.updated_at ? (Date.now()-new Date(r.updated_at))/86400000 : null
  if(age!==null && age>45) add('age','Analysis date','amber','These numbers are '+Math.round(age)+' days old — re-run comps before you sign.')

  const overall = checks.some(c=>c.status==='red') ? 'red' : checks.some(c=>c.status==='amber') ? 'amber' : 'green'
  const title = overall==='green' ? 'Safe to lock at this price' : overall==='amber' ? 'Proceed carefully' : "Don't lock at this price"
  return { checks, overall, title }
}
// Creative deals (subject-to / seller finance) are judged on terms, not the cash max.
function creativeLock(r, price){
  const checks = [], add = (key,label,status,text) => checks.push({ key, label, status, text })
  const m = r.creative || {}, kind = r.exit==='subto' ? 'Subject-to' : 'Seller finance'
  const conf = r.confidence
  add('arv','ARV confidence', conf==='High'?'green':conf==='Medium'?'amber':'red', (conf||'Low')+' confidence in the '+money(r.arv)+' ARV.')
  if(r.exit==='subto') add('debt','Loan numbers', r.debtVerified?'green':'red', r.debtVerified ? 'Verified from a statement.' : 'Not verified — get a mortgage statement. Subject-to lives or dies on the real balance and payment.')
  else add('debt','Existing debt', !r.payoff ? 'green' : r.payoffCovered ? 'green' : 'amber', !r.payoff ? 'Free & clear.' : r.payoffCovered ? 'Down payment covers the '+money(r.payoff)+' owed.' : 'Seller still owes '+money(r.payoff)+' — only works as a wrap. Have a title company review it.')
  const cf = Number(m.cashflow)||0
  add('cashflow','Cash flow', cf>=250?'green':cf>=100?'amber':'red', money(cf)+'/mo after expenses for the creative buyer'+(cf<100?' — most will pass.':'.'))
  const coc = Number(m.coc)||0
  add('coc','Cash-on-cash', coc>=0.12?'green':coc>=0.06?'amber':'red', Math.round(coc*100)+'% on a '+money(m.entry)+' entry fee.')
  const eq = Number(m.equity)||0
  add('equity','Equity after repairs', eq>=0?'green':eq>=-5000?'amber':'red', (eq<0?'Short ':'')+money(Math.abs(eq))+(eq<0?' — buyer starts upside down.':' of equity on day one.'))
  if(price && m.price && price>m.price*1.02) add('price','Price vs. your terms','amber',money(price)+' is above the '+money(m.price)+' you underwrote — re-run the numbers at this price.')
  const overall = checks.some(c=>c.status==='red') ? 'red' : checks.some(c=>c.status==='amber') ? 'amber' : 'green'
  const title = overall==='green' ? 'Safe to lock — '+kind : overall==='amber' ? 'Proceed carefully — '+kind : "Don't lock on these terms"
  return { checks, overall, title }
}
export const LIGHT = { green:'#3fd08a', amber:'#f5b942', red:'#e5573f' }
