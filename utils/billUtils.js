exports.generateBillNumber = () => {
  const date = new Date();
  return (
    "BILL-" +
    date.getFullYear() +
    (date.getMonth() + 1) +
    date.getDate() +
    "-" +
    Math.floor(1000 + Math.random() * 9000)
  );
};

exports.generateQrNumber = () => {
  return "QR-" + Math.floor(100000 + Math.random() * 900000);
};

/* ---------------- QR VISIBILITY LOGIC ---------------- */
exports.calculateQrVisibleTime = (collectionTime) => {
  const now = Date.now();

  if (collectionTime === "Now") {
    return new Date(now);
  }

  if (collectionTime === "5 minutes") {
    return new Date(now + 2 * 60 * 1000);
  }

  if (collectionTime === "10 minutes") {
    return new Date(now + 5 * 60 * 1000);
  }

  if (collectionTime === "15 minutes") {
    return new Date(now + 10 * 60 * 1000);
  }

  // Default fallback
  return new Date(now + 10 * 60 * 1000);
};
