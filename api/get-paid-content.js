const { createClient } = require('@supabase/supabase-js');

const {
  getEnvironment,
  jsonResponse
} = require('./_paystack');

exports.handler = async function (event) {
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

    const token = authorization.replace('Bearer ', '');

    const supabase = createClient(
      getEnvironment('SUPABASE_URL'),
      getEnvironment('SUPABASE_SERVICE_ROLE_KEY')
    );

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return jsonResponse(401, {
        error: 'Invalid session.'
      });
    }

    const { data: purchase, error: purchaseError } =
      await supabase
        .from('purchases')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'success')
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
