// Supabase returns at most 1,000 rows per request. This pages through everything.
export async function fetchAllRows(build, pageSize=1000, cap=200000){
  const all = [], seen = new Set()
  for(let from=0; from<cap; from+=pageSize){
    const { data, error } = await build().range(from, from+pageSize-1)
    if(error) throw error
    for(const r of data||[]){ const k = r.id ?? JSON.stringify(r); if(!seen.has(k)){ seen.add(k); all.push(r) } }
    if(!data || data.length<pageSize) break
  }
  return all
}
