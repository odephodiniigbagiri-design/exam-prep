const { createClient } = require('@supabase/supabase-js');

const {
  getEnvironment,
  verifyPaystackTransaction,
  isValidPaystackSignature,
  jsonResponse
} = require('./_paystack');

function getSupabaseAdmin() {
  return createClient(
    getEnvironment('SUPABASE_URL'),
    getEnvironment('SUPABASE_SERVICE_ROLE_KEY')
  );
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, {
      error: 'Method not allowed.'
    });
  }

  try {
    const signature =
      event.headers['x-paystack-signature'] ||
      event.headers['X-Paystack-Signature'];

    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body || '';

    if (!isValidPaystackSignature(rawBody, signature)) {
      return jsonResponse(401, {
        error: 'Invalid Paystack signature.'
      });
    }

    const payload = JSON.parse(rawBody);

    if (payload.event !== 'charge.success') {
      return jsonResponse(200, {
        received: true,
        ignored: true
      });
    }

    const reference = payload.data && payload.data.reference;
    const transaction = await verifyPaystackTransaction(reference);
    const email = String(transaction.customer.email)
      .trim()
      .toLowerCase();

    const supabase = getSupabaseAdmin();

    const { data: users, error: userError } =
      await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000
      });

    if (userError) {
      throw userError;
    }

    const matchingUser = users.users.find(
      user => user.email && user.email.toLowerCase() === email
    );

    const { error } = await supabase
      .from('purchases')
      .upsert(
        {
          user_id: matchingUser ? matchingUser.id : null,
          email,
          reference: transaction.reference,
          amount_kobo: transaction.amount,
          status: 'success',
          paid_at: transaction.paid_at || new Date().toISOString()
        },
        {
          onConflict: 'reference'
        }
      );

    if (error) {
      throw error;
    }

    return jsonResponse(200, {
      received: true
    });
  } catch (error) {
    console.error(error);

    return jsonResponse(500, {
      error: 'Webhook processing failed.'
    });
  }
};
