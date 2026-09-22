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

  if (req.method !== 'POST') {
    return json(res, 405, {
      error: 'Method not allowed.'
    });
  }

  try {
    const authorization = req.headers.authorization || '';

    if (!authorization.startsWith('Bearer ')) {
      return json(res, 401, {
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
        error: 'Invalid login session.'
      });
    }

    const phone = String(req.body?.phone || '').trim();
    const department = String(req.body?.department || '').trim();

    const { error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          email: user.email.toLowerCase(),
          phone,
          department,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: 'id'
        }
      );

    if (error) {
      throw error;
    }

    return json(res, 200, {
      saved: true
    });
  } catch (error) {
    console.error(error);

    return json(res, 500, {
      error: 'Unable to save profile.'
    });
  }
};
