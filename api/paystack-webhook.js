const {
  verifyPaystackTransaction,
  json,
  isValidPaystackSignature
} = require('./_paystack');

const {
  getSupabaseAdmin
} = require('../lib/supabase-admin');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed.'
    });
  }

  try {
    const signature =
      req.headers['x-paystack-signature'];

    /*
     * This requires Vercel to provide the raw request body.
     * The config below disables automatic JSON parsing.
     */
    const rawBody = req.body;

    if (
      typeof rawBody !== 'string' ||
      !isValidPaystackSignature(rawBody, signature)
    ) {
      return res.status(401).json({
        error: 'Invalid Paystack signature.'
      });
    }

    const payload = JSON.parse(rawBody);

    if (payload.event !== 'charge.success') {
      return res.status(200).json({
        received: true,
        ignored: true
      });
    }

    const reference = payload.data?.reference;
    const transaction =
      await verifyPaystackTransaction(reference);

    const email = String(
      transaction.customer?.email || ''
    ).trim().toLowerCase();

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

    return res.status(200).json({
      received: true
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: 'Webhook processing failed.'
    });
  }
};

module.exports.config = {
  api: {
    bodyParser: false
  }
};
