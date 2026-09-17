import { defineMiddleware } from "astro:middleware";

// Serve the shared client-side boat profile shell for direct development URLs.
// Cloudflare Pages uses public/_redirects for the equivalent static rewrite.
export const onRequest = defineMiddleware((context, next) => {
  if (/^\/boats\/[^/]+\/?$/.test(context.url.pathname)) {
    const destination = new URL(context.url);
    destination.pathname = "/boats/";
    return context.rewrite(destination);
  }
  return next();
});
