// api/create-checkout-session.js
//
// Vercel Serverless Function. Reçoit le panier envoyé par le site, recalcule
// les prix ICI (jamais depuis les données envoyées par le navigateur — sinon
// n'importe qui peut modifier le prix via les devtools avant de payer), puis
// crée une vraie session Stripe Checkout et renvoie son URL au site.
//
// Variables d'environnement à définir sur Vercel (Project Settings > Environment Variables) :
//   STRIPE_SECRET_KEY  -> Stripe Dashboard > Developers > API keys (clé "secret", sk_live_... / sk_test_...)
//   SITE_URL           -> l'URL de ton site déployé, ex: https://nuance.vercel.app (sans slash final)

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Garde cette liste synchronisée avec le tableau `products` dans nuance-boutique.html.
// C'est la SEULE source de vérité pour les prix côté serveur.
const PRODUCTS = {
  1: { name: 'Maybelline — Lash Sensational Mascara', price: 18.90 },
  2: { name: 'Huda Beauty — Obsessions Eyeshadow Palette', price: 38.00 },
  3: { name: 'NYX Professional Makeup — Born To Glow Fond de Teint', price: 20.90 },
  4: { name: 'e.l.f. Cosmetics — Camo Anti-Cernes', price: 14.90 },
  5: { name: 'The Ordinary — Sérum Vitamine C 23% + HA', price: 15.90 },
  6: { name: 'CeraVe — Crème Hydratante', price: 22.90 },
  7: { name: 'La Roche-Posay — Anthelios UVMune SPF50+', price: 23.90 },
  8: { name: 'Huda Beauty — Rouge à Lèvres Liquide Mat', price: 32.90 },
  9: { name: 'NYX Professional Makeup — Butter Gloss', price: 13.90 },
  10: { name: 'Real Techniques — Éponge Miracle Complexion', price: 14.90 }
};

// Garde cette liste synchronisée avec le tableau `packs` dans nuance-boutique.html.
const PACKS = {
  p1: { name: 'Pack Maquillage Essentiel', price: 49.90 },
  p2: { name: 'Pack Routine Éclat', price: 55.90 },
  p3: { name: 'Pack Duo Lèvres', price: 40.90 }
};

const FREE_SHIPPING_THRESHOLD = 50; // en euros
const SHIPPING_COST = 4.90;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  }

  try {
    const { cart } = req.body || {};
    if (!cart || typeof cart !== 'object' || Object.keys(cart).length === 0) {
      return res.status(400).json({ error: 'Panier vide.' });
    }

    let subtotal = 0;
    const line_items = [];

    for (const [id, qty] of Object.entries(cart)) {
      const quantity = Number(qty);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
        return res.status(400).json({ error: 'Article invalide dans le panier.' });
      }

      const isPack = String(id).indexOf('pack_') === 0;
      const item = isPack ? PACKS[id.replace('pack_', '')] : PRODUCTS[id];
      if (!item) {
        return res.status(400).json({ error: 'Article invalide dans le panier.' });
      }

      subtotal += item.price * quantity;
      line_items.push({
        quantity,
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(item.price * 100), // Stripe compte en centimes
          product_data: { name: item.name }
        }
      });
    }

    // Livraison : ajoutée comme ligne séparée. Si un code promo Stripe fait passer
    // la commande sous le seuil après réduction, tant pis pour cette version simple —
    // on calcule sur le sous-total avant code promo, ce qui reste favorable au client.
    if (subtotal < FREE_SHIPPING_THRESHOLD) {
      line_items.push({
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(SHIPPING_COST * 100),
          product_data: { name: 'Livraison' }
        }
      });
    }

    const siteUrl = process.env.SITE_URL || `https://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      allow_promotion_codes: true, // Stripe affiche son propre champ code promo et gère la validation
      shipping_address_collection: { allowed_countries: ['FR', 'BE', 'CH', 'LU'] },
      success_url: `${siteUrl}/?commande=confirmee&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/`
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Erreur create-checkout-session:', err);
    return res.status(500).json({ error: 'Erreur serveur, réessaie dans un instant.' });
  }
};
