const {
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

  if (req.method !== 'GET') {
    return json(res, 405, {
      error: 'Method not allowed.'
    });
  }

  try {
    const authorization =
      req.headers.authorization || '';

    if (!authorization.startsWith('Bearer ')) {
      return json(res, 401, {
        paid: false,
        error: 'Sign-in required.'
      });
    }

    const token = authorization.substring(7);
    const supabase = getSupabaseAdmin();

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser(token);

    if (userError || !user || !user.email) {
      return json(res, 401, {
        paid: false,
        error: 'Invalid login session.'
      });
    }

    const email = user.email.trim().toLowerCase();

    const { data: purchase, error: purchaseError } =
      await supabase
        .from('purchases')
        .select('id, reference, paid_at, user_id')
        .eq('email', email)
        .eq('status', 'success')
        .eq('amount_kobo', 20000)
        .limit(1)
        .maybeSingle();

    if (purchaseError) {
      throw purchaseError;
    }

    if (!purchase) {
      return json(res, 200, {
        paid: false,
        email,
        reference: null
      });
    }

    /*
     * Link old email-based purchases to the authenticated
     * Supabase user. This is safe because the user has already
     * authenticated through Supabase using the verified email.
     */
    if (!purchase.user_id) {
      const { error: linkError } =
        await supabase
          .from('purchases')
          .update({
            user_id: user.id
          })
          .eq('id', purchase.id)
          .is('user_id', null);

      if (linkError) {
        throw linkError;
      }
    }

    return json(res, 200, {
      paid: true,
      email,
      reference: purchase.reference
    });
  } catch (error) {
    console.error(error);

    return json(res, 500, {
      paid: false,
      error: 'Unable to check access.'
    });
  }
};
