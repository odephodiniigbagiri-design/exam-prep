const { createClient } = require('@supabase/supabase-js');

const {
  getEnvironment,
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

  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, {
      error: 'Method not allowed.'
    });
  }

  try {
    const authorization =
      event.headers.authorization ||
      event.headers.Authorization ||
      '';

    if (!authorization.startsWith('Bearer ')) {
      return jsonResponse(401, {
        paid: false,
        error: 'You must be signed in.'
      });
    }

    const accessToken = authorization.replace('Bearer ', '');
    const supabase = getSupabaseAdmin();

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return jsonResponse(401, {
        paid: false,
        error: 'Invalid login session.'
      });
    }

    const { data: purchase, error: purchaseError } =
      await supabase
        .from('purchases')
        .select('reference, paid_at')
        .eq('user_id', user.id)
        .eq('status', 'success')
        .limit(1)
        .maybeSingle();

    if (purchaseError) {
      throw purchaseError;
    }

    return jsonResponse(200, {
      paid: Boolean(purchase),
      email: user.email,
      reference: purchase ? purchase.reference : null
    });
  } catch (error) {
    console.error(error);

    return jsonResponse(500, {
      paid: false,
      error: 'Unable to check access.'
    });
  }
};
