// api/admin/orders.js
//
// Liste les commandes directement depuis Stripe (aucune base de données séparée —
// Stripe garde déjà l'historique complet). Protégé par le même mot de passe admin.
//
// Query param optionnel : ?starting_after=cs_xxx pour paginer (bouton "Charger plus").

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  const provided = req.headers['x-admin-password'];
  if (!provided || provided !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Mot de passe incorrect.' });
  }

  try {
    const params = { limit: 20, expand: ['data.line_items', 'data.payment_intent'] };
    if (req.query && req.query.starting_after) params.starting_after = req.query.starting_after;

    const sessions = await stripe.checkout.sessions.list(params);
    const isTestKey = (process.env.STRIPE_SECRET_KEY || '').startsWith('sk_test');

    const orders = sessions.data
      .filter((s) => s.payment_status === 'paid')
      .map((s) => {
        const addr = (s.shipping_details && s.shipping_details.address) || (s.customer_details && s.customer_details.address);
        const name = (s.shipping_details && s.shipping_details.name) || (s.customer_details && s.customer_details.name);
        const pi = s.payment_intent && typeof s.payment_intent === 'object' ? s.payment_intent : null;
        const meta = pi ? pi.metadata : {};
        return {
          id: s.id,
          paymentIntentId: pi ? pi.id : s.payment_intent,
          date: new Date(s.created * 1000).toISOString(),
          email: s.customer_details ? s.customer_details.email : null,
          name: name || null,
          address: addr
            ? [addr.line1, addr.line2, addr.postal_code, addr.city, addr.country].filter(Boolean).join(', ')
            : null,
          items: s.line_items ? s.line_items.data.map((li) => ({ name: li.description, qty: li.quantity })) : [],
          total: s.amount_total / 100,
          promoUsed: !!(s.total_details && s.total_details.amount_discount > 0),
          trackingCarrier: (meta && meta.tracking_carrier) || '',
          trackingNumber: (meta && meta.tracking_number) || '',
          stripeUrl: 'https://dashboard.stripe.com/' + (isTestKey ? 'test/' : '') + 'payments/' + (pi ? pi.id : s.payment_intent)
        };
      });

    return res.status(200).json({
      orders,
      hasMore: sessions.has_more,
      lastId: sessions.data.length ? sessions.data[sessions.data.length - 1].id : null
    });
  } catch (err) {
    console.error('Erreur admin/orders:', err);
    return res.status(500).json({ error: 'Erreur lors de la récupération des commandes.' });
  }
};
