const getUrl = () => process.env.SUPABASE_URL + '/rest/v1';
const getKey = () => process.env.SUPABASE_SERVICE_KEY;

const mkHeaders = (extra = {}) => ({
  'apikey': getKey(),
  'Authorization': `Bearer ${getKey()}`,
  'Content-Type': 'application/json',
  ...extra,
});

async function doFetch(method, url, { body, single } = {}) {
  const h = mkHeaders({
    ...(single ? { 'Accept': 'application/vnd.pgrst.object+json' } : {}),
    ...(method === 'POST' ? { 'Prefer': 'return=representation' } : {}),
  });
  const res = await fetch(url, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ message: 'error' }));
    return { data: null, error: e };
  }
  const data = method === 'DELETE' ? null : await res.json().catch(() => null);
  return { data, error: null };
}

export const supabase = {
  from(table) {
    const params = [];
    let selectCols = '*';

    const buildUrl = () => {
      const qs = new URLSearchParams({ select: selectCols });
      params.forEach(([k, v]) => qs.append(k, v));
      return `${getUrl()}/${table}?${qs}`;
    };

    const chain = {
      select(cols = '*') { selectCols = cols; return chain; },
      eq(col, val)  { params.push([col, `eq.${val}`]);  return chain; },
      neq(col, val) { params.push([col, `neq.${val}`]); return chain; },
      gte(col, val) { params.push([col, `gte.${val}`]); return chain; },
      order(col, { ascending = true } = {}) {
        params.push(['order', `${col}.${ascending ? 'asc' : 'desc'}`]);
        return chain;
      },
      limit(n) { params.push(['limit', String(n)]); return chain; },
      single() { return doFetch('GET', buildUrl(), { single: true }); },

      insert(data) {
        const url = `${getUrl()}/${table}`;
        const ic = {
          select() { return ic; },
          single() { return doFetch('POST', url, { body: data, single: true }); },
          then(res, rej) { return doFetch('POST', url, { body: data }).then(res, rej); },
        };
        return ic;
      },

      update(data) {
        return {
          eq(col, val) {
            return doFetch('PATCH', `${getUrl()}/${table}?${col}=eq.${val}`, { body: data });
          },
        };
      },

      delete() {
        return {
          eq(col, val) {
            return doFetch('DELETE', `${getUrl()}/${table}?${col}=eq.${val}`);
          },
        };
      },

      then(res, rej) { return doFetch('GET', buildUrl()).then(res, rej); },
    };

    return chain;
  },
};
