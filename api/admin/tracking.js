// api/admin/tracking.js
//
// Enregistre un numéro de suivi sur une commande. Stocké dans les métadonnées
// du PaymentIntent Stripe (mutable à tout moment, contrairement à la Checkout
// Session déjà finalisée) — encore une fois, aucune base de données séparée.
// Envoie aussi un email au client pour le prévenir que sa commande est partie.
//
// Variables déjà en place, rien de nouveau à ajouter.

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
  const provided = req.headers['x-admin-password'];
  if (!provided || provided !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Mot de passe incorrect.' });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  }

  try {
    const { paymentIntentId, carrier, trackingNumber, customerEmail, customerName } = req.body || {};
    if (!paymentIntentId || !trackingNumber) {
      return res.status(400).json({ error: 'Numéro de suivi requis.' });
    }

    await stripe.paymentIntents.update(paymentIntentId, {
      metadata: {
        tracking_carrier: carrier || '',
        tracking_number: trackingNumber
      }
    });

    // Email au client — best effort, une erreur d'envoi ne doit pas faire échouer
    // l'enregistrement du numéro de suivi lui-même.
    if (customerEmail) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
        });
        await transporter.sendMail({
          from: 'NUANCE <' + process.env.GMAIL_USER + '>',
          to: customerEmail,
          subject: 'Votre commande NUANCE est en route',
          html:
            '<p>Bonjour ' + (customerName || '') + ',</p>' +
            '<p>Votre commande vient d\'être expédiée' + (carrier ? ' via ' + carrier : '') + '.</p>' +
            '<p>Numéro de suivi : <strong>' + trackingNumber + '</strong></p>' +
            '<p style="color:#888;font-size:13px;">Besoin d\'aide ? Répondez à cet email ou écrivez à nuanceprosupport@gmail.com</p>'
        });
      } catch (emailErr) {
        console.error('Email de suivi non envoyé:', emailErr);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Erreur admin/tracking:', err);
    return res.status(500).json({ error: 'Erreur lors de l\'enregistrement du suivi.' });
  }
};
