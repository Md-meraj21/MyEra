const crypto = require('crypto');

/**
 * Generates a secure random 4-digit numeric code
 * @returns {string} 4-digit string (e.g. "4829")
 */
const generateCode = () => {
  // Generate a cryptographically secure random integer between 1000 and 9999
  const randomBuffer = crypto.randomBytes(2);
  const randomInt = randomBuffer.readUInt16BE(0);
  const code = (1000 + (randomInt % 9000)).toString();
  return code;
};

module.exports = generateCode;
