import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseProxyUrl =
  import.meta.env.VITE_SUPABASE_PROXY_URL ?? 'https://supabase-proxy.libinlong123.workers.dev';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const directSupabaseOrigin = new URL(supabaseUrl).origin;
const proxyOrigin = new URL(supabaseProxyUrl).origin;

const supabaseProxyFetch: typeof fetch = async (input, init) => {
  const request = input instanceof Request ? input : new Request(input, init);
  const method = (init?.method ?? request.method ?? 'GET').toUpperCase();
  const requestUrl = new URL(request.url);
  const isSupabaseRequest = requestUrl.origin === directSupabaseOrigin;
  const isAuthRequest = requestUrl.pathname.startsWith('/auth/v1/');

  // Route read-only API calls through Cloudflare Worker cache, but keep auth direct.
  if (method === 'GET' && isSupabaseRequest && !isAuthRequest) {
    const proxiedUrl = `${proxyOrigin}${requestUrl.pathname}${requestUrl.search}`;
    if (input instanceof Request) {
      return fetch(new Request(proxiedUrl, request), init);
    }
    return fetch(proxiedUrl, init);
  }

  return fetch(input, init);
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: supabaseProxyFetch,
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
