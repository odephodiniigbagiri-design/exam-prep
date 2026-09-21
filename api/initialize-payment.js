const {
  getEnvironment,
  json,
  addCors
} = require('./_paystack');

module.exports = async function handler(req, res) {
  addCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return json(res, 405, {
      error: 'Method not allowed.'
    });
  }

  try {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();

    if (!email || !email.includes('@')) {
      return json(res, 400, {
        error: 'A valid email address is required.'
      });
    }

    const response = await fetch(
      'https://api.paystack.co/transaction/initialize',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getEnvironment(
            'PAYSTACK_SECRET_KEY'
          )}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          amount: 20000,
          callback_url: `${getEnvironment(
            'SITE_URL'
          )}/payment-success.html`
        })
      }
    );

    const result = await response.json();

    if (!response.ok || !result.status) {
      return json(res, 400, {
        error: result.message || 'Unable to start payment.'
      });
    }

    return json(res, 200, {
      authorization_url: result.data.authorization_url,
      reference: result.data.reference
    });
  } catch (error) {
    console.error(error);

    return json(res, 500, {
      error: 'Payment initialization failed.'
    });
  }
};
