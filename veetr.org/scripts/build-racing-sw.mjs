import {generateSW} from 'workbox-build';
await generateSW({
 globDirectory:'dist',swDest:'dist/veetr-app-sw.js',
 globPatterns:['veetr-app.webmanifest','veetr-app-cs.webmanifest','img/veetr-app-*.png','_astro/*.{js,css,woff2}','races/index.html','races/manage/index.html','races/new/index.html','boats/index.html','account/index.html','cs/races/index.html','cs/races/manage/index.html','cs/races/new/index.html','cs/boats/index.html','cs/account/index.html'],
 maximumFileSizeToCacheInBytes:5*1024*1024,
 cleanupOutdatedCaches:true,clientsClaim:true,skipWaiting:false,
 // Only the application paths are served from cache. Never intercept documentation or marketing navigation.
 ignoreURLParametersMatching:[/.*/],
 navigateFallback:'boats/',
 navigateFallbackAllowlist:[/^\/boats\/[^/?]+\/?(?:\?.*)?$/],
 runtimeCaching:[{urlPattern:/\/cs\/boats\/[^/?]+\/?(?:\?.*)?$/,handler:'NetworkFirst',options:{cacheName:'veetr-cs-boat-pages',precacheFallback:{fallbackURL:'cs/boats/'}}}],
 modifyURLPrefix:{'cs/races/index.html':'cs/races/','cs/races/manage/index.html':'cs/races/manage/','cs/races/new/index.html':'cs/races/new/','cs/boats/index.html':'cs/boats/','cs/account/index.html':'cs/account/','races/index.html':'races/','races/manage/index.html':'races/manage/','races/new/index.html':'races/new/','boats/index.html':'boats/','account/index.html':'account/'},
});
