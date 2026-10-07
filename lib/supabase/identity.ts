import { eq } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';
import { getDb } from '@/lib/db';
import { users } from '@/db/schema';

export async function getCurrentIdentity() {
  let supabase;
  let user;
  try {
    supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (error) {
    console.error('[identity auth lookup]', error instanceof Error ? error.message : error);
  }
  if (!user) return null;
  const authAvatar = typeof user.user_metadata?.avatar_url === 'string'
    ? user.user_metadata.avatar_url
    : typeof user.user_metadata?.picture === 'string'
      ? user.user_metadata.picture
      : null;
  const authName = typeof user.user_metadata?.name === 'string'
    ? user.user_metadata.name
    : typeof user.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name
      : user.email?.split('@')[0] ?? null;
  const db = getDb();
  if (!db) return { id: user.id, name: authName, avatar: authAvatar, role: 'investor' as const, email: user.email ?? null };
  try {
    const profile = await db.select({ id: users.id, role: users.role, email: users.email }).from(users).where(eq(users.id, user.id)).limit(1);
    if (profile.length === 0) {
      await db.insert(users).values({
        id: user.id,
        email: user.email ?? '',
        name: authName ?? 'User',
        image: authAvatar,
        role: 'investor',
      }).onConflictDoNothing();
      return { id: user.id, name: authName ?? 'User', avatar: authAvatar, role: 'investor' as const, email: user.email ?? null };
    }
    const dbRole = profile[0]?.role === 'admin' ? 'admin' : 'investor';
    return { id: user.id, name: authName, avatar: authAvatar, role: dbRole, email: profile[0]?.email ?? user.email ?? null };
  } catch {
    return { id: user.id, name: authName, avatar: authAvatar, role: 'investor' as const, email: user.email ?? null };
  }
}
