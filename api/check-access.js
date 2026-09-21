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

    if (userError || !user) {
      return json(res, 401, {
        paid: false,
        error: 'Invalid login session.'
      });
    }

    const { data: purchase, error } =
      await supabase
        .from('purchases')
        .select('reference, paid_at')
        .eq('email', user.email.toLowerCase())
        .eq('status', 'success')
        .eq('amount_kobo', 20000)
        .limit(1)
        .maybeSingle();

    if (error) {
      throw error;
    }

    return json(res, 200, {
      paid: Boolean(purchase),
      email: user.email,
      reference: purchase?.reference || null
    });
  } catch (error) {
    console.error(error);

    return json(res, 500, {
      paid: false,
      error: 'Unable to check access.'
    });
  }
};
