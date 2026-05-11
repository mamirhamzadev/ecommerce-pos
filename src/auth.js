const bcrypt = require('bcryptjs');

const ROUNDS = 10;

function hashPassword(plain) {
  return bcrypt.hashSync(plain, ROUNDS);
}

function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

module.exports = { hashPassword, verifyPassword };
