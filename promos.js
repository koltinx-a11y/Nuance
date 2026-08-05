// api/admin/promos.js
//
// Gère les codes promo partenaires (ex: Squeezie) en s'appuyant entièrement sur
// Stripe (Coupons + Promotion Codes) — aucune base de données séparée.
//
// La "fenêtre d'affichage" (display_start / display_end) est stockée dans les
// métadonnées du Promotion Code Stripe. Elle sert uniquement à piloter QUAND le
// bandeau apparaît sur le site (voir /api/active-promos) — la vraie protection
// contre une utilisation prématurée, c'est que personne ne connaît le code tant
// que tu ne l'as pas communiqué. La date de fin (display_end) est aussi envoyée
// à Stripe comme expires_at réel : passé cette date, le code ne fonctionne plus
// du tout au paiement, automatiquement.
//
// Variables d'environnement nécessaires (en plus de celles déjà utilisées) :
//   ADMIN_PASSWORD -> mot de passe que tu choisis, à définir sur Vercel

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

function checkAuth(req, res) {
  const provided = req.headers['x-admin-password'];
  if (!provided || provided !== process.env.ADMIN_PASSWORD) {
    res.status(401).json({ error: 'Mot de passe incorrect.' });
    return false;
  }
  return true;
}

function formatDiscount(coupon) {
  if (coupon.percent_off) return '-' + coupon.percent_off + ' %';
  if (coupon.amount_off) return '-' + (coupon.amount_off / 100).toFixed(2) + ' €';
  return '—';
}

module.exports = async (req, res) => {
  if (!checkAuth(req, res)) return;

  // ---- Lister les codes existants ----
  if (req.method === 'GET') {
    try {
      const list = await stripe.promotionCodes.list({ limit: 100 });
      const promos = list.data.map((pc) => ({
        id: pc.id,
        code: pc.code,
        active: pc.active,
        partner: pc.metadata.partner_name || '',
        displayStart: pc.metadata.display_start || '',
        displayEnd: pc.metadata.display_end || '',
        discount: formatDiscount(pc.coupon),
        timesRedeemed: pc.times_redeemed,
        maxRedemptions: pc.max_redemptions || null
      })).sort((a, b) => (a.displayStart < b.displayStart ? 1 : -1));
      return res.status(200).json({ promos });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Erreur lors de la récupération des codes.' });
    }
  }

  // ---- Créer un nouveau code partenaire ----
  if (req.method === 'POST') {
    try {
      const { code, partner, percentOff, amountOff, displayStart, displayEnd, maxRedemptions } = req.body || {};
      if (!code || !code.trim()) return res.status(400).json({ error: 'Le code est requis.' });
      if (!percentOff && !amountOff) return res.status(400).json({ error: 'Indique un pourcentage ou un montant de réduction.' });

      const couponParams = { duration: 'once', name: partner ? 'Partenariat ' + partner : undefined };
      if (percentOff) couponParams.percent_off = Number(percentOff);
      if (amountOff) {
        couponParams.amount_off = Math.round(Number(amountOff) * 100);
        couponParams.currency = 'eur';
      }
      const coupon = await stripe.coupons.create(couponParams);

      const promoParams = {
        coupon: coupon.id,
        code: code.trim().toUpperCase(),
        metadata: {
          partner_name: partner || '',
          display_start: displayStart || '',
          display_end: displayEnd || ''
        }
      };
      if (maxRedemptions) promoParams.max_redemptions = Number(maxRedemptions);
      if (displayEnd) {
        const ts = Math.floor(new Date(displayEnd).getTime() / 1000);
        if (!Number.isNaN(ts)) promoParams.expires_at = ts;
      }

      const promotionCode = await stripe.promotionCodes.create(promoParams);
      return res.status(200).json({ id: promotionCode.id, code: promotionCode.code });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message || 'Erreur lors de la création du code.' });
    }
  }

  // ---- Activer / désactiver manuellement (le bouton "faire apparaître/disparaître") ----
  if (req.method === 'PATCH') {
    try {
      const { id, active } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id requis.' });
      await stripe.promotionCodes.update(id, { active: !!active });
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Erreur lors de la mise à jour.' });
    }
  }

  res.setHeader('Allow', 'GET, POST, PATCH');
  return res.status(405).json({ error: 'Méthode non autorisée.' });
};
