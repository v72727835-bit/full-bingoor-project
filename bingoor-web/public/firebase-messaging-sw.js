/* Background push for the website. The Firebase keys arrive in the URL (?cfg=...) from the admin-managed settings. */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

try {
  const cfg = JSON.parse(atob(decodeURIComponent(new URL(self.location.href).searchParams.get('cfg') || '')));
  firebase.initializeApp({
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain,
    projectId: cfg.projectId,
    appId: cfg.appId,
    messagingSenderId: cfg.messagingSenderId,
  });
  // The message carries a "notification" block, so the browser shows it by itself; we only handle the click.
  firebase.messaging();
} catch (e) {
  /* not configured yet */
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && (event.notification.data.FCM_MSG?.data?.url || event.notification.data.url)) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) { c.navigate(url); return c.focus(); }
      return clients.openWindow(url);
    }),
  );
});
