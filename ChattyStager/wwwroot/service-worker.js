// service-worker.js

const VERSION = '1.0.3';
const STATIC_FILES_PATH = '/static-files/';
const STATIC_TAG = '.taggedstaticcontentpaths';

function __log(first, ...rest) {
    const TAG = '[CW-SW]';
    if (rest.length > 0) {
        console.log(`${TAG} ${first}`, ...rest);
    } else {
        console.log(`${TAG} ${first}`);
    }
}

self.addEventListener('install', (event) => {
    __log('preparing SW');
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    __log('init SW');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== VERSION) {
                        __log('removed cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

const CACHEABLE_EXTS = /\.(css|ttf)$/i;
const CACHEABLE_FAVICONS = /\/favicon\.(png|svg|ico)$/i;

function shouldCache(url) {
    return url.pathname.startsWith(STATIC_FILES_PATH)
        || url.search.endsWith(STATIC_TAG)
        || CACHEABLE_EXTS.test(url.pathname)
        || CACHEABLE_FAVICONS.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (shouldCache(url)) {
        event.respondWith(
            caches.open(VERSION).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    if (cachedResponse)
                        return cachedResponse;

                    return fetch(event.request).then((networkResponse) => {
                        if (networkResponse.status === 200) {
                            __log('CACHE:', event.request.url);
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch((error) => {
                        console.error('SW Error:', event.request.url, error);
                        return new Response('Network not reachable', {
                            status: 540,
                            statusText: 'Unknown Issue. Not caught precisely.'
                        });
                    });
                });
            })
        );
    }
});