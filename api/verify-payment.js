const {
  verifyPaystackTransaction,
  json,
  addCors
} = require('./_paystack');

const {
  getSupabaseAdmin
} = require('../lib/supabase-admin');

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
    const reference = String(req.body?.reference || '')
      .trim();

    if (!reference) {
      return json(res, 400, {
        error: 'Payment reference is required.'
      });
    }

    const transaction =
      await verifyPaystackTransaction(reference);

    const email = String(
      transaction.customer?.email || ''
    ).trim().toLowerCase();

    if (!email) {
      throw new Error(
        'Paystack did not return a customer email.'
      );
    }

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('purchases')
      .upsert(
        {
          email,
          reference: transaction.reference,
          amount_kobo: Number(transaction.amount),
          status: 'success',
          paid_at:
            transaction.paid_at ||
            new Date().toISOString()
        },
        {
          onConflict: 'reference'
        }
      );

    if (error) {
      throw error;
    }

    return json(res, 200, {
      paid: true,
      email,
      reference: transaction.reference
    });
  } catch (error) {
    console.error(error);

    return json(res, 400, {
      paid: false,
      error: error.message ||
        'Payment verification failed.'
    });
  }
};
