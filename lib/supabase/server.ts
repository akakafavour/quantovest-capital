import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // Fail closed: never construct a client with an undefined URL/key (the old
  // `!` assertion crashed with an obscure error). Callers map this throw to a
  // 503 "Service temporarily unavailable" response.
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Service temporarily unavailable: Supabase is not configured.');
  }
  return createServerClient(supabaseUrl, supabaseKey, {
    cookieOptions: { maxAge: 60 * 60 * 24 * 7 },
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* Server Components cannot always mutate cookies. */ }
      },
    },
  });
}
