const isNowBetween = (start, end) => {
  const now = new Date();

  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);

  const startTime = new Date();
  startTime.setHours(sh, sm, 0, 0);

  const endTime = new Date();
  endTime.setHours(eh, em, 0, 0);

  return now >= startTime && now <= endTime;
};

module.exports = { isNowBetween };
