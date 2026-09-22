const {
  getSupabaseAdmin
} = require('../lib/supabase-admin');

function jsonResponse(status, data) {
  return {
    statusCode: status,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  };
}

exports.handler = async function handler(event) {
  try {
    const authorization =
      event.headers.authorization ||
      event.headers.Authorization ||
      '';

    if (!authorization.startsWith('Bearer ')) {
      return jsonResponse(401, {
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
      return jsonResponse(401, {
        error: 'Invalid session.'
      });
    }

    const email = user.email.trim().toLowerCase();

    /*
     * Use user_id first. The email fallback allows old purchases
     * to continue working while migration is in progress.
     */
    const { data: purchase, error: purchaseError } =
      await supabase
        .from('purchases')
        .select('id, user_id, email')
        .eq('status', 'success')
        .eq('amount_kobo', 20000)
        .or(`user_id.eq.${user.id},email.eq.${email}`)
        .limit(1)
        .maybeSingle();

    if (purchaseError) {
      throw purchaseError;
    }

    if (!purchase) {
      return jsonResponse(403, {
        error: 'Payment required.'
      });
    }

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

    const { data: content, error: contentError } =
      await supabase
        .from('paid_content')
        .select('content_key, content_json');

    if (contentError) {
      throw contentError;
    }

    return jsonResponse(200, {
      content
    });
  } catch (error) {
    console.error(error);

    return jsonResponse(500, {
      error: 'Unable to load paid content.'
    });
  }
};
