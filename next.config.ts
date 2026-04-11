import path from "node:path";
import type { NextConfig } from "next";

// Content-Security-Policy for the entire app.
//
// Notes on the choices below:
//
// - `'unsafe-inline'` on script-src and style-src is required by Next.js
//   App Router hydration and next/font's CSS injection. A tighter nonce-
//   based CSP would need a request-level middleware that injects a nonce
//   per response; that is a follow-up.
// - `'unsafe-eval'` on script-src is required by Mapbox GL JS, which uses
//   `new Function(...)` to compile style expressions at runtime, and by
//   the Next.js dev overlay.
// - `blob:` on worker-src is required by Mapbox GL JS, which spawns a
//   Web Worker for tile decoding from a blob URL.
// - `https://*.mapbox.com` covers api.mapbox.com (geocoding + styles +
//   tileset metadata), events.mapbox.com (telemetry), and
//   *.tiles.mapbox.com (sharded tile CDN).
// - `https://*.supabase.co` + `wss://*.supabase.co` cover the project
//   Supabase REST client and the Realtime WebSocket upgrade path. Only
//   the project-specific subdomain is actually hit in prod; the wildcard
//   keeps preview / branch deployments working without per-environment
//   CSP edits.
// - `frame-ancestors 'none'` denies embedding in any iframe. Paired with
//   `X-Frame-Options: DENY` below for defense in depth on older browsers.
// - `object-src 'none'` blocks legacy <object>/<embed>/<applet> XSS
//   vectors. None are used by the app.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.mapbox.com https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.mapbox.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: CONTENT_SECURITY_POLICY,
  },
  {
    // Two-year HSTS with subdomain inclusion and preload eligibility.
    // Vercel serves *.vercel.app over HTTPS only, so this is safe to set
    // even without a custom apex domain.
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Redundant with CSP frame-ancestors for modern browsers, but old
    // browsers and some security scanners still look for the legacy
    // header. Keeping both costs one line.
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Deny camera and microphone (not used). Allow geolocation on self
    // origin only — the "find stores near me" flow uses
    // navigator.geolocation.getCurrentPosition in src/hooks/useGeolocation.ts.
    // Opt out of FLoC / Topics via interest-cohort=().
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    root: path.resolve(__dirname),
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
