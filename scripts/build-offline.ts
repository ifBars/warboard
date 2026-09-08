import { readdir } from "node:fs/promises";
const base = process.env.DEPLOY_BASE || "/";
const assets = (await readdir("dist/assets")).map((name) => `/assets/${name}`);
const core = [
  "/",
  "/index.html",
  "/favicon.svg",
  "/brand-mark.svg",
  "/map-icons/tower.webp",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/maps/bakurani.webp",
  "/maps/ozeti.webp",
  "/maps/community-color/bakurani.webp",
  "/maps/community-color/ozeti.webp",
  "/maps/color/bakurani.webp",
  "/maps/color/ozeti.webp",
  "/terrain/bakurani/preview.json",
  "/terrain/ozeti/preview.json",
  ...assets,
];
const hasher = new Bun.CryptoHasher("sha256");
for (const path of core.filter((p) => p !== "/"))
  hasher.update(await Bun.file(`dist${path}`).arrayBuffer());
const version = hasher.digest("hex").slice(0, 12);
await Bun.write(
  "dist/sw.js",
  `const CORE='warboard-core-${version}',RUNTIME='warboard-runtime-${version}';
const BASE=${JSON.stringify(base)};
const FILES=${JSON.stringify(core.map(p => base + p.slice(1)))};
self.addEventListener('install',e=>e.waitUntil(caches.open(CORE).then(c=>c.addAll(FILES))));
self.addEventListener('message',e=>{if(e.data==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('warboard-')&&key!==CORE&&key!==RUNTIME)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;
 if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.open(CORE).then(c=>c.match(BASE+'index.html'))));return;}
 if(!['/assets/','/maps/','/terrain/','/obstacles/','/icon-'].some(p=>u.pathname.startsWith(BASE+p.slice(1)))&&!['/favicon.svg','/brand-mark.svg','/manifest.webmanifest'].includes('/'+u.pathname.slice(BASE.length)))return;
 e.respondWith((async()=>{const core=await caches.open(CORE);const fixed=await core.match(e.request,{ignoreVary:true});if(fixed)return fixed;const cache=await caches.open(RUNTIME);const saved=await cache.match(e.request,{ignoreVary:true});if(saved)return saved;const response=await fetch(e.request);if(response.ok){try{await cache.put(e.request,response.clone());const keys=await cache.keys();for(const key of keys.slice(0,Math.max(0,keys.length-96)))await cache.delete(key);}catch{}}return response;})());
});`,
);
console.log(
  `Offline shell ${version}: ${core.length} resources; detail/terrain cache limited to 96 files.`,
);
