// api/verify-login.js
//
// Vérifie le token signé reçu par email (voir api/request-login.js), puis va
// chercher dans Stripe toutes les commandes payées avec cet email — aucune
// base de données de comptes n'est nécessaire, Stripe reste la seule source
// de vérité.

const crypto = require('crypto');
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

function verify(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;

  const expectedSig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null; // signature invalide -> lien falsifié ou corrompu
  }

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (!payload.email || !payload.expires || Date.now() > payload.expires) return null; // expiré
    return payload;
  } catch (e) {
    return null;
  }
}

module.exports = async (req, res) => {
  const token = req.query && req.query.token;
  const payload = verify(token, process.env.MAGIC_LINK_SECRET);
  if (!payload) {
    return res.status(401).json({ error: 'Lien invalide ou expiré — redemande un lien de connexion.' });
  }

  try {
    const sessions = await stripe.checkout.sessions.list({ limit: 100, expand: ['data.line_items', 'data.payment_intent'] });
    const orders = sessions.data
      .filter((s) =>
        s.payment_status === 'paid' &&
        s.customer_details &&
        s.customer_details.email &&
        s.customer_details.email.toLowerCase() === payload.email
      )
      .map((s) => {
        const pi = s.payment_intent && typeof s.payment_intent === 'object' ? s.payment_intent : null;
        const meta = pi ? pi.metadata : {};
        return {
          date: new Date(s.created * 1000).toISOString(),
          items: s.line_items ? s.line_items.data.map((li) => ({ name: li.description, qty: li.quantity })) : [],
          total: s.amount_total / 100,
          trackingCarrier: (meta && meta.tracking_carrier) || '',
          trackingNumber: (meta && meta.tracking_number) || ''
        };
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));

    return res.status(200).json({ email: payload.email, orders });
  } catch (err) {
    console.error('Erreur verify-login:', err);
    return res.status(500).json({ error: 'Erreur lors de la récupération de vos commandes.' });
  }
};
