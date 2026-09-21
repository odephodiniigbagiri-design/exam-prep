const {
  getEnvironment,
  jsonResponse
} = require('./_paystack');

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(204, {});
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, {
      error: 'Method not allowed.'
    });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const email = String(body.email || '').trim().toLowerCase();

    if (!email || !email.includes('@')) {
      return jsonResponse(400, {
        error: 'A valid email address is required.'
      });
    }

    const secretKey = getEnvironment('PAYSTACK_SECRET_KEY');
    const siteUrl = getEnvironment('SITE_URL');

    const response = await fetch(
      'https://api.paystack.co/transaction/initialize',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          amount: 20000,
          callback_url: `${siteUrl}/payment-success.html`
        })
      }
    );

    const result = await response.json();

    if (!response.ok || !result.status) {
      return jsonResponse(400, {
        error: result.message || 'Unable to initialize payment.'
      });
    }

    return jsonResponse(200, {
      authorization_url: result.data.authorization_url,
      access_code: result.data.access_code,
      reference: result.data.reference
    });
  } catch (error) {
    console.error(error);

    return jsonResponse(500, {
      error: 'Payment initialization failed.'
    });
  }
};
