import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { verifyTwoFactorToken } from '@/lib/2fa-session';

function isPublicRoute(pathname: string): boolean {
  if (
    pathname === '/' ||
    pathname === '/how-it-works' ||
    pathname === '/about' ||
    pathname === '/services' ||
    pathname === '/plans' ||
    pathname === '/faq' ||
    pathname === '/contact' ||
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/admin/login'
  ) {
    return true;
  }
  if (pathname.startsWith('/legal/')) return true;
  if (pathname.startsWith('/api/plans')) return true;
  if (pathname.startsWith('/api/auth/')) return true;
  if (pathname.startsWith('/api/health')) return true;
  if (pathname.startsWith('/api/cron/')) return true;
  return false;
}

function isInvestorRoute(pathname: string): boolean {
  if (pathname.startsWith('/dashboard')) return true;
  const investorApiRoutes = [
    '/api/deposits',
    '/api/withdrawals',
    '/api/kyc',
    '/api/uploads',
    '/api/notifications',
    '/api/profile',
    '/api/history',
    '/api/referrals',
    '/api/deposit-instructions',
    '/api/investor-profile',
    '/api/portfolio',
    '/api/swap',
    '/api/traders',
    '/api/push',
  ];
  return investorApiRoutes.some((route) => pathname.startsWith(route));
}

function isAdminRoute(pathname: string): boolean {
  if (pathname.startsWith('/admin')) return true;
  if (pathname.startsWith('/api/admin')) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  if (process.env.NODE_ENV === 'production' && request.headers.get('x-forwarded-proto') === 'http') {
    const host = request.headers.get('host') || request.nextUrl.host;
    return NextResponse.redirect(`https://${host}${request.nextUrl.pathname}${request.nextUrl.search}`, 301);
  }

  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // Fail closed: without the Supabase URL/key the middleware cannot verify
  // sessions, so every request (pages and API) gets a 503 instead of an
  // unauthenticated passthrough that would bypass route guards.
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: 'Service temporarily unavailable.' },
      { status: 503 },
    );
  }

  const { pathname, searchParams } = request.nextUrl;
  if (pathname === '/' && searchParams.has('code')) {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = '/auth/callback';
    callbackUrl.searchParams.set('next', searchParams.get('next') || '/dashboard');
    return NextResponse.redirect(callbackUrl);
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  const isAuthenticated = !!user;

  // Resolve role from the database (authoritative), not from app_metadata.
  // app_metadata can be manipulated by the user via the Supabase Auth API,
  // so it must never be trusted for authorization decisions.
  let isAdmin = false;
  let twoFactorEnabled = false;
  if (isAuthenticated) {
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('role,twoFactorEnabled')
        .eq('id', user.id)
        .limit(1)
        .single();
      if (profile) {
        isAdmin = (profile as { role?: string }).role === 'admin';
        twoFactorEnabled = (profile as { twoFactorEnabled?: boolean }).twoFactorEnabled === true;
      }
    } catch {
      // Fail closed: if we can't verify the role, treat as non-admin.
      isAdmin = false;
    }
  }

  // Enforce 2FA for all authenticated users who have it enabled.
  if (isAuthenticated && twoFactorEnabled && pathname !== '/verify-2fa' && !pathname.startsWith('/api/auth/2fa')) {
    const verified = await verifyTwoFactorToken(request.cookies.get('qv_2fa_verified')?.value, user.id).catch(() => false);
    if (!verified) {
      if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Two-factor verification required.' }, { status: 403 });
      return NextResponse.redirect(new URL('/verify-2fa', request.url));
    }
  }

  if (isPublicRoute(pathname)) {
    if (isAuthenticated && (pathname === '/login' || pathname === '/signup' || pathname === '/admin/login')) {
      return NextResponse.redirect(new URL(isAdmin ? '/admin' : '/dashboard', request.url));
    }
    return response;
  }

  if (isAdminRoute(pathname)) {
    if (!isAuthenticated) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/login', request.url));
    }
    if (!isAdmin) {
      // API consumers must get machine-readable 403s, not a redirect to a page.
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return response;
  }

  if (isInvestorRoute(pathname)) {
    if (!isAuthenticated) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/login', request.url));
    }
    if (isAdmin && !pathname.startsWith('/admin')) {
      if (
        pathname === '/api/notifications' ||
        pathname.startsWith('/api/notifications/') ||
        pathname === '/api/investor-profile' ||
        pathname.startsWith('/api/investor-profile/')
      ) {
        return response;
      }
      return NextResponse.redirect(new URL('/admin', request.url));
    }
    return response;
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
