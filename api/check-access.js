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

    let { data: purchase, error } =
      await supabase
        .from('purchases')
        .select('id, reference, paid_at, user_id')
        .eq('user_id', user.id)
        .eq('status', 'success')
        .eq('amount_kobo', 20000)
        .limit(1)
        .maybeSingle();

    if (error) {
      throw error;
    }

    /*
     * Migration fallback for old payment records.
     * Once a matching purchase is found, permanently link it
     * to the authenticated Supabase user.
     */
    if (!purchase) {
      const result = await supabase
        .from('purchasesUse this implementation in the `exam-prep` repository. It does not require old users to pay again.

## 1. Replace `app.js`

Replace the entire contents of:

```text
app.js
