// utils/timeUtils.js

/**
 * Get current time in IST (Asia/Kolkata)
 * Returns a Date object already shifted to IST
 */
function getISTNow() {
  const now = new Date();

  // Convert local server time → UTC → IST
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
  const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes

  return new Date(utcTime + istOffset);
}

/**
 * Check if current IST time is between start and end
 * @param {string} start - "HH:MM"
 * @param {string} end   - "HH:MM"
 */
function isNowBetween(start, end) {
  if (!start || !end) return true; // safety fallback

  const nowIST = getISTNow();

  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);

  const startTime = new Date(nowIST);
  startTime.setHours(sh, sm, 0, 0);

  const endTime = new Date(nowIST);
  endTime.setHours(eh, em, 0, 0);

  // Normal same-day range (08:00 → 15:00)
  if (startTime <= endTime) {
    return nowIST >= startTime && nowIST <= endTime;
  }

  // Overnight range (22:00 → 02:00)
  return nowIST >= startTime || nowIST <= endTime;
}

module.exports = { isNowBetween };
