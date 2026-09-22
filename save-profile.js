const {
  getSupabaseAdmin
} = require('../lib/supabase-admin');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed.'
    });
  }

  try {
    const authorization = req.headers.authorization || '';

    if (!authorization.startsWith('Bearer ')) {
      return res.status(401).json({
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
      return res.status(401).json({
        error: 'Invalid login session.'
      });
    }

    const fullName = String(req.body?.full_name || '').trim();
    const email = String(req.body?.email || user.email || '').trim().toLowerCase();
    const department = String(req.body?.department || '').trim();
    const phone = String(req.body?.phone || '').trim();

    if (!email || !email.includes('@')) {
      return res.status(400).json({
        error: 'A valid email is required.'
      });
    }

    const { error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          full_name: fullName || user.user_metadata?.full_name || '',
          email,
          department,
          phone,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: 'id'
        }
      );

    if (error) {
      throw error;
    }

    return res.status(200).json({
      saved: true
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: 'Unable to save profile.'
    });
  }
};
