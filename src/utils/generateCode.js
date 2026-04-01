const crypto = require("crypto");

function generateVerificationCode() {
  // generates a random 6-digit code
  return crypto.randomInt(100000, 999999).toString();
}

module.exports = { generateVerificationCode };