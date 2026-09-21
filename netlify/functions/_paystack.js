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
  if (!reference || typeof reference !== 'string') {
    throw new Error('A payment reference is required.');
  }

  const secretKey = getEnvironment('PAYSTACK_SECRET_KEY');

  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`
      }
    }
  );

  const result = await response.json();

  if (!response.ok || !result.status) {
    throw new Error(
      result.message || 'Paystack transaction verification failed.'
    );
  }

  const transaction = result.data;

  if (!transaction || transaction.status !== 'success') {
    throw new Error('The transaction was not successful.');
  }

  if (Number(transaction.amount) !== EXPECTED_AMOUNT_KOBO) {
    throw new Error('The payment amount is not ₦200.');
  }

  return transaction;
}

function isValidPaystackSignature(rawBody, signature) {
  if (!signature) {
    return false;
  }

  const secretKey = getEnvironment('PAYSTACK_SECRET_KEY');

  const expectedSignature = crypto
    .createHmac('sha512', secretKey)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature)
  );
}

function jsonResponse(statusCode, data) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': process.env.SITE_URL || '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    },
    body: JSON.stringify(data)
  };
}

module.exports = {
  EXPECTED_AMOUNT_KOBO,
  getEnvironment,
  verifyPaystackTransaction,
  isValidPaystackSignature,
  jsonResponse
};
