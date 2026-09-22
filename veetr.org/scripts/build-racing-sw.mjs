import {generateSW} from 'workbox-build';
await generateSW({
 globDirectory:'dist',swDest:'dist/veetr-app-sw.js',
 globPatterns:['veetr-app.webmanifest','img/veetr-app-*.png','_astro/*.{js,css,woff2}','races/index.html','races/manage/index.html','races/new/index.html','boats/index.html','account/index.html'],
 maximumFileSizeToCacheInBytes:5*1024*1024,
 cleanupOutdatedCaches:true,clientsClaim:true,skipWaiting:false,
 // Only the application paths are served from cache. Never intercept documentation or marketing navigation.
 ignoreURLParametersMatching:[/.*/],
 navigateFallback:'boats/',
 navigateFallbackAllowlist:[/^\/boats\/[^/?]+\/?(?:\?.*)?$/],
 modifyURLPrefix:{'races/index.html':'races/','races/manage/index.html':'races/manage/','races/new/index.html':'races/new/','boats/index.html':'boats/','account/index.html':'account/'},
});
