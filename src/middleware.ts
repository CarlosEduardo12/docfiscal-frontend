import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  // Security: Enforce HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    const proto = req.headers.get('x-forwarded-proto');
    if (proto === 'http') {
      const httpsUrl = `https://${req.headers.get('host')}${req.nextUrl.pathname}${req.nextUrl.search}`;
      return NextResponse.redirect(httpsUrl, 301);
    }
  }

  // Security: Add additional security headers
  const response = NextResponse.next();

  // Content Security Policy for enhanced security
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requires unsafe-eval and unsafe-inline
    "style-src 'self' 'unsafe-inline'", // Tailwind requires unsafe-inline
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' https: http://localhost:8000", // Allow connection to backend
    "frame-ancestors 'none'",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Robots-Tag', 'noindex, nofollow'); // Prevent indexing of sensitive pages

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
