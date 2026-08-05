// api/active-promos.js
//
// Endpoint PUBLIC (pas de mot de passe) — appelé par le site à chaque chargement
// de page pour savoir quels codes partenaires afficher en ce moment. Un code est
// affiché s'il est actif ET que la date/heure actuelle est dans sa fenêtre
// display_start / display_end (métadonnées définies depuis le panel admin).
//
// En cas d'erreur ou si le backend n'est pas encore déployé, cette route (ou le
// site qui l'appelle) échoue silencieusement : le site continue d'afficher son
// bandeau par défaut, rien ne casse.

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  try {
    const list = await stripe.promotionCodes.list({ active: true, limit: 100 });
    const now = new Date();

    const visible = list.data
      .filter((pc) => {
        const start = pc.metadata.display_start ? new Date(pc.metadata.display_start) : null;
        const end = pc.metadata.display_end ? new Date(pc.metadata.display_end) : null;
        if (start && now < start) return false;
        if (end && now > end) return false;
        return true;
      })
      .map((pc) => {
        const coupon = pc.coupon;
        const discountText = coupon.percent_off
          ? '-' + coupon.percent_off + ' %'
          : '-' + (coupon.amount_off / 100).toFixed(2) + ' €';
        return {
          code: pc.code,
          partner: pc.metadata.partner_name || '',
          discountText
        };
      });

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json({ promos: visible });
  } catch (err) {
    console.error('Erreur active-promos:', err);
    return res.status(200).json({ promos: [] }); // on échoue "ouvert" : le site garde son bandeau par défaut
  }
};
