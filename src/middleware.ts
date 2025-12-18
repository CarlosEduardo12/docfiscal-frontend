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
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requires unsafe-eval and unsafe-inline
    "style-src 'self' 'unsafe-inline' data:", // Tailwind and Next.js styles
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    isDevelopment 
      ? "connect-src 'self' https: http: ws: wss:" // Allow all connections in development
      : "connect-src 'self' https: http://localhost:8000", // Restrict in production
    "frame-ancestors 'none'",
  ].join('; ');

  // Temporarily disable CSP in development for debugging
  if (process.env.NODE_ENV !== 'development') {
    response.headers.set('Content-Security-Policy', csp);
  }
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
