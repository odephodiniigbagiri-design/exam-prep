const { createClient } = require('@supabase/supabase-js');

const {
  getEnvironment,
  verifyPaystackTransaction,
  jsonResponse
} = require('./_paystack');

function getSupabaseAdmin() {
  return createClient(
    getEnvironment('SUPABASE_URL'),
    getEnvironment('SUPABASE_SERVICE_ROLE_KEY')
  );
}

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
    const reference = String(body.reference || '').trim();

    if (!reference) {
      return jsonResponse(400, {
        error: 'Payment reference is required.'
      });
    }

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

    const { error: purchaseError } = await supabase
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

    if (purchaseError) {
      throw purchaseError;
    }

    return jsonResponse(200, {
      paid: true,
      email,
      reference: transaction.reference
    });
  } catch (error) {
    console.error(error);

    return jsonResponse(400, {
      paid: false,
      error: error.message || 'Payment verification failed.'
    });
  }
};
