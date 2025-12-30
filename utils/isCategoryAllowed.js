export const isTimeBetween = (start, end) => {
  const now = new Date();
  const [sh, sm] = start.split(":");
  const [eh, em] = end.split(":");

  const startTime = new Date();
  startTime.setHours(sh, sm, 0);

  const endTime = new Date();
  endTime.setHours(eh, em, 0);

  return now >= startTime && now <= endTime;
};
