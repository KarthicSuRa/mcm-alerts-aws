
let notificationCount = 0;

self.addEventListener('push', () => {
  notificationCount++;
  if (self.navigator.setAppBadge) {
    self.navigator.setAppBadge(notificationCount);
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_BADGE') {
    notificationCount = 0;
    if (self.navigator.clearAppBadge) {
      self.navigator.clearAppBadge();
    }
  }
});

self.addEventListener('notificationclick', () => {
  notificationCount = 0;
  if (self.navigator.clearAppBadge) {
    self.navigator.clearAppBadge();
  }
});
