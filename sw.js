// Service worker: lets the app open offline and pick up new versions when online.
// Bump CACHE (v1 -> v2 ...) whenever you upload a new index.html so phones refresh.
var CACHE = "install-tracker-v14";
var CORE = ["./", "./index.html", "./config.js", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"];
// only these outside sites are ever cached; the database (supabase.co) must never be
var CACHEABLE_HOSTS = ["cdn.jsdelivr.net", "cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(CORE); }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e){
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // our own files: network first so new versions arrive right away, cached copy when offline
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req, {cache: "no-cache"}).then(function(res){
        if (res && res.ok) {
          var copy = res.clone();
          var key = req.mode === "navigate" ? "./index.html" : req;
          caches.open(CACHE).then(function(c){ c.put(key, copy); });
        }
        return res;
      }).catch(function(){
        return caches.match(req).then(function(r){
          return r || (req.mode === "navigate" ? caches.match("./index.html") : Response.error());
        });
      })
    );
    return;
  }

  // fonts/libraries from known CDNs: cached copy first, then network and remember it
  if (CACHEABLE_HOSTS.indexOf(url.hostname) !== -1) {
    e.respondWith(
      caches.match(req).then(function(hit){
        if (hit) return hit;
        return fetch(req).then(function(res){
          if (res && (res.ok || res.type === "opaque")) {
            var copy = res.clone();
            caches.open(CACHE).then(function(c){ c.put(req, copy); });
          }
          return res;
        });
      })
    );
  }
  // anything else (the database, sign-in) goes straight to the network, never cached
});
