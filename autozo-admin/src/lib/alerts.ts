/** Two short beeps via the Web Audio API — no asset file needed, works the moment the tab has focus. */
export function playChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.16].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.001, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.32);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.34);
    });
  } catch {
    // best-effort — some browsers block audio before any user click, which is fine to skip
  }
}

/**
 * Raises a desktop notification for a new order. Asked for once, the first
 * time the panel opens; if the admin declines, the chime still plays.
 */
export function notifyNewOrders(count: number, onClick: () => void) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(count === 1 ? 'New order received' : `${count} new orders received`, {
      body: 'Open Live Orders to accept it.',
      icon: '/logo-mark.png',
      tag: 'bingoor-new-order',
    });
    n.onclick = () => {
      window.focus();
      onClick();
      n.close();
    };
  } catch {
    // some browsers only allow notifications from a service worker; the chime covers it
  }
}

export function askNotificationPermission() {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => undefined);
  }
}
