// Change RELEASE whenever any shipped app asset changes. Installation is atomic.
const RELEASE='0.9-web.1', PREFIX='kalima-web-'+encodeURIComponent(new URL(self.registration.scope).pathname)+'-', CACHE=PREFIX+RELEASE;
const ASSETS=["native-prompts.mjs","android.css","bootstrap.mjs","./","api.mjs","app.mjs","apple-touch-icon.png","config.js","core.mjs","corpus.mjs","icon-192.png","icon-512.png","icon-maskable-512.png","index.html","manifest.webmanifest","motion.mjs","nahj-data.json","quran-data.json","search.js","styles.css","suggestions.json","ui-translations.json","ui.mjs","amiri_bold.ttf","amiri_quran.ttf","amiri_regular.ttf","instrument_sans.ttf","instrument_sans_medium.ttf","instrument_sans_semibold.ttf","noto_nastaliq_urdu.ttf","noto_nastaliq_urdu_semibold.ttf","vazirmatn.ttf","vazirmatn_medium.ttf"];
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  try{await cache.addAll(ASSETS.map(path=>new Request(new URL(path,self.registration.scope),{cache:'reload'})));}
  catch(error){await caches.delete(CACHE);throw error;}
})()));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url),scope=new URL(self.registration.scope);
  if(request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
  const relative=url.pathname.slice(scope.pathname.length)||'./';
  if(request.mode!=='navigate'&&!ASSETS.includes(relative))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE),cached=await cache.match(request.mode==='navigate'?new URL('./',scope):request,{ignoreSearch:true});
    return cached||fetch(request);
  })());
});
