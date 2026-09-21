const crypto = require('crypto');

const EXPECTED_AMOUNT_KOBO = 20000;

function getEnvironment(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

async function verifyPaystackTransaction(reference) {
  if (!reference) {
    throw new Error('Payment reference is required.');
  }

  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${getEnvironment('PAYSTACK_SECRET_KEY')}`
      }
    }
  );

  const result = await response.json();

  if (!response.ok || !result.status) {
    throw new Error(
      result.message || 'Paystack verification failed.'
    );
  }

  const transaction = result.data;

  if (!transaction || transaction.status !== 'success') {
    throw new Error('Transaction was not successful.');
  }

  if (Number(transaction.amount) !== EXPECTED_AMOUNT_KOBO) {
    throw new Error('The payment amount is not ₦200.');
  }

  return transaction;
}

function json(res, status, data) {
  return res.status(status).json(data);
}

function addCors(res) {
  res.setHeader(
    'Access-Control-Allow-Origin',
    process.env.SITE_URL || '*'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Paystack-Signature'
  );
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, OPTIONS'
  );
}

function isValidPaystackSignature(rawBody, signature) {
  if (!signature) {
    return false;
  }

  const expected = crypto
    .createHmac(
      'sha512',
      getEnvironment('PAYSTACK_SECRET_KEY')
    )
    .update(rawBody)
    .digest('hex');

  const expectedBuffer = Buffer.from(expected, 'utf8');
  const receivedBuffer = Buffer.from(signature, 'utf8');

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    expectedBuffer,
    receivedBuffer
  );
}

module.exports = {
  EXPECTED_AMOUNT_KOBO,
  getEnvironment,
  verifyPaystackTransaction,
  json,
  addCors,
  isValidPaystackSignature
};
