// Reads sold comps out of whatever gets pasted: Zillow / Redfin page text, or links.
// Links can't be opened from the browser (Zillow and Redfin block other sites), so for links
// we fill in the address from the URL and the user types price / sqft / sold date.

const num = v => { const n = Number(String(v??'').replace(/[$,\s]/g,'')); return isFinite(n) ? n : 0 }
let seq = 0
const newId = () => 'c'+Date.now().toString(36)+(seq++)
const SUFFIX = /^(st|street|ave|avenue|rd|road|dr|drive|ln|lane|ct|court|blvd|boulevard|way|pl|place|cir|circle|ter|terrace|pkwy|parkway|hwy|highway|trl|trail|loop|run|sq|square|path|pike|row|walk|xing|crossing|cv|cove|pt|point|aly|alley|plz|plaza)$/i
const DIR = /^(n|s|e|w|ne|nw|se|sw|apt|unit|ste|#?\d+[a-z]?)$/i
const title = s => s.replace(/\b\w/g, c=>c.toUpperCase())

export function toISODate(s){
  if(!s) return ''
  let t = String(s).trim().replace(/\.$/,'')
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/); if(iso) return iso[0]
  const us = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
  if(us){ const y = us[3].length===2 ? 2000+Number(us[3]) : Number(us[3]); return y+'-'+us[1].padStart(2,'0')+'-'+us[2].padStart(2,'0') }
  t = t.replace(/^([A-Za-z]+)-(\d{1,2})-(\d{4})$/,'$1 $2 $3')
  const d = new Date(t); if(isNaN(d)) return ''
  const p = n => String(n).padStart(2,'0')
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())
}

// "1234-Main-St-Apt-2-Jacksonville-FL-32210" -> "1234 Main St Apt 2, Jacksonville, FL 32210"
function addressFromSlug(words, state, zip, city){
  if(city) return title(words.join(' '))+', '+title(city)+', '+state.toUpperCase()+' '+zip
  let cut = -1
  for(let i=1;i<words.length;i++){ if(SUFFIX.test(words[i])){ cut = i; while(cut+1<words.length && DIR.test(words[cut+1])) cut++ } }
  if(cut<0 || cut>=words.length-1) return title(words.join(' '))+', '+state.toUpperCase()+' '+zip
  return title(words.slice(0,cut+1).join(' '))+', '+title(words.slice(cut+1).join(' '))+', '+state.toUpperCase()+' '+zip
}
export function compsFromLinks(text){
  const out = []
  for(const m of text.matchAll(/zillow\.com\/homedetails\/([A-Za-z0-9-]+)\//gi)){
    const w = m[1].split('-'); const zip = w.pop(), st = w.pop()
    if(/^\d{5}$/.test(zip) && /^[A-Za-z]{2}$/.test(st)) out.push({ address:addressFromSlug(w, st, zip), source:'zillow' })
  }
  for(const m of text.matchAll(/redfin\.com\/([A-Za-z]{2})\/([A-Za-z0-9-]+)\/([A-Za-z0-9-]+?)-(\d{5})\/(?:unit-[^/]+\/)?home/gi)){
    out.push({ address:addressFromSlug(m[3].split('-'), m[1], m[4], m[2].replace(/-/g,' ')), source:'redfin' })
  }
  return out.map(c=>({ id:newId(), address:c.address, price:'', beds:'', baths:'', sqft:'', year:'', soldDate:'', cond:'', on:true, fromLink:true }))
}

export function compFromText(text){
  const t = String(text).replace(/ /g,' ').replace(/[ \t]+/g,' ')
  const m = re => { const x=t.match(re); return x ? x[1] : '' }
  let price = m(/(?:sold for|sold price|sold:|last sold (?:for|price)?|sale price|sold at|closing price)[:\s]*\$\s?([\d,]{5,})/i)
  if(!price){ const all=[...t.matchAll(/\$\s?([\d,]{5,})(?!\s*\/\s*(?:mo|month|sqft|sq))/gi)].map(x=>num(x[1])).filter(n=>n>=20000); if(all.length) price=String(all[0]) }
  const sold = m(/(?:sold(?: on)?|date sold|sold date|sale date|closed(?: on)?)[:\s-]*([A-Za-z]{3,9}\.? \d{1,2},? \d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/i)
  let addr = (t.match(/\d+[^,\n$]{2,60},\s*[A-Za-z .'-]{2,40},\s*[A-Z]{2}\s*\d{5}/)||[''])[0]
  if(!addr){ const two = t.match(/(\d+ [^,\n$]{2,60})\n\s*([A-Za-z .'-]{2,40}),\s*([A-Z]{2})\s*(\d{5})/); if(two) addr = two[1].trim()+', '+two[2].trim()+', '+two[3]+' '+two[4] }
  return {
    id:newId(), address:addr.replace(/\s+/g,' ').trim(), price:num(price)||'',
    beds:m(/(\d+(?:\.\d+)?)\s*(?:bd|bds|beds?|bedrooms?)\b/i),
    baths:m(/(\d+(?:\.\d+)?)\s*(?:ba|baths?|bathrooms?)\b/i),
    sqft:num(m(/([\d,]{3,6})\s*(?:sq\.?\s*ft\.?|sqft|square (?:feet|ft))/i))||'',
    year:m(/(?:built in|year built:?)\s*(\d{4})/i),
    soldDate:toISODate(sold), cond:'', on:true,
  }
}

// Main entry: returns { comps, kind:'links'|'text'|'empty', missing:[...] }
export function parsePaste(text){
  const links = compsFromLinks(text)
  const stripped = String(text).replace(/https?:\/\/\S+/g,' ').trim()
  if(links.length && stripped.length<40) return { comps:links, kind:'links', missing:['price','sqft','sold date'] }
  const c = compFromText(text)
  const missing = [!c.address&&'address',!c.price&&'price',!c.sqft&&'sqft',!c.soldDate&&'sold date'].filter(Boolean)
  if(missing.length>=3 && !c.address && !c.price) return { comps:[], kind:'empty', missing }
  return { comps:[c], kind:'text', missing }
}
