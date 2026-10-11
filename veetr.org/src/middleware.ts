import { defineMiddleware } from "astro:middleware";

// Serve the shared client-side boat profile shell for direct development URLs.
// Cloudflare Pages uses public/_redirects for the equivalent static rewrite.
export const onRequest = defineMiddleware((context, next) => {
  if (/^\/(?:cs\/)?join\/[^/]+\/?$/.test(context.url.pathname)) {
    const destination = new URL(context.url); destination.pathname = context.url.pathname.startsWith("/cs/") ? "/cs/join/" : "/join/";
    return context.rewrite(destination);
  }
  if (/^\/(?:cs\/)?boats\/[^/]+\/?$/.test(context.url.pathname)) {
    const destination = new URL(context.url);
    destination.pathname = context.url.pathname.startsWith("/cs/") ? "/cs/boats/" : "/boats/";
    return context.rewrite(destination);
  }
  return next();
});
