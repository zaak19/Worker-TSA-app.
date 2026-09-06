/* Worker TSA — Firebase Cloud Messaging service worker */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBDU1lzUrvTice37EqfptIPdcsAAqqbl8E',
  authDomain: 'worker-tsa-93bb4.firebaseapp.com',
  projectId: 'worker-tsa-93bb4',
  storageBucket: 'worker-tsa-93bb4.firebasestorage.app',
  messagingSenderId: '115836395473',
  appId: '1:115836395473:web:ba01f028d52253bcf50af0'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const notification = payload.notification || {};
  const title = notification.title || 'Worker TSA';
  const options = {
    body: notification.body || 'Une nouvelle notification est disponible.',
    icon: '/icon.png',
    badge: '/icon.png',
    data: { url: (payload.fcmOptions && payload.fcmOptions.link) || '/' }
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
    for (const client of clientList) {
      if ('focus' in client) {
        client.focus();
        if ('navigate' in client) client.navigate(url);
        return;
      }
    }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});
