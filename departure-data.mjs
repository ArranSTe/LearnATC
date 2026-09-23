const cache = new Map();
export async function getDepartures(airport, runway, fetcher = fetch) {
  if (!/^[A-Z]{4}$/.test(airport) || !/^(0[1-9]|[12]\d|3[0-6])[LRC]?$/.test(runway)) throw new Error('Invalid airport or runway');
  const key = `${airport}/${runway}`;
  const cached = cache.get(key);
  if (fetcher === fetch && cached?.expires > Date.now()) return cached.body;
  const procedures = new Map();
  let cycle = null;
  const signal = AbortSignal.timeout(10000);
  for (let page = 1; page <= 20; page++) {
    const query = new URLSearchParams({airport, runway, type:'SID', per_page:'100', page:String(page)});
    const response = await fetcher(`https://airac.net/api/v1/procedures?${query}`, {signal, headers:{Accept:'application/json'}});
    if (!response.ok) throw new Error('Departure source unavailable');
    const body = await response.json();
    if (body.status !== 'success' || !Array.isArray(body.data)) throw new Error('Invalid departure response');
    cycle = response.headers.get('x-airac-cycle') || cycle;
    for (const item of body.data) {
      if (item.airport === airport && item.type?.code === 'SID' && /^[A-Z0-9]{1,16}$/.test(item.identifier)) procedures.set(item.identifier, {identifier:item.identifier});
    }
    if (!body.pagination?.has_more) {
      const result = {data:[...procedures.values()].sort((a,b)=>a.identifier.localeCompare(b.identifier)), airport, runway, source:'AIRAC API', cycle};
      if (fetcher === fetch) {
        if (cache.size >= 500) cache.delete(cache.keys().next().value);
        cache.set(key, {body:result, expires:Date.now()+900000});
      }
      return result;
    }
  }
  throw new Error('Incomplete departure results');
}
