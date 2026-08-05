// api/request-login.js
//
// Système de compte SANS mot de passe : le client entre son email, reçoit un
// lien signé (valable 15 min) par email via Gmail. Cliquer sur ce lien suffit
// à prouver qu'il a accès à cette boîte mail — pas de mot de passe à stocker,
// pas de base de données de comptes. Les commandes affichées viennent
// directement de Stripe (voir api/verify-login.js).
//
// Variables d'environnement nécessaires :
//   GMAIL_USER          -> nuancepro@gmail.com
//   GMAIL_APP_PASSWORD  -> mot de passe d'application généré depuis le compte Google (PAS le mot de passe normal)
//   MAGIC_LINK_SECRET   -> une chaîne aléatoire longue, choisie par toi, qui sert à signer les liens
//   SITE_URL            -> l'URL de ton site déployé

const crypto = require('crypto');
const nodemailer = require('nodemailer');

function sign(payload, secret) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return data + '.' + hmac;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  }

  const { email } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Adresse email invalide.' });
  }

  try {
    const expires = Date.now() + 15 * 60 * 1000; // 15 minutes
    const token = sign({ email: email.toLowerCase().trim(), expires }, process.env.MAGIC_LINK_SECRET);
    const siteUrl = process.env.SITE_URL || `https://${req.headers.host}`;
    const link = siteUrl + '/?compte_token=' + encodeURIComponent(token);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
    });

    await transporter.sendMail({
      from: 'NUANCE <' + process.env.GMAIL_USER + '>',
      to: email,
      subject: 'Votre lien de connexion NUANCE',
      html:
        '<p>Bonjour,</p>' +
        '<p>Cliquez sur ce lien pour voir vos commandes (valable 15 minutes) :</p>' +
        '<p><a href="' + link + '">Voir mes commandes</a></p>' +
        "<p style=\"color:#888;font-size:13px;\">Si vous n'avez rien demandé, ignorez simplement cet email.</p>" +
        '<p style="color:#888;font-size:13px;">Besoin d\'aide ? Écrivez à nuanceprosupport@gmail.com</p>'
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Erreur request-login:', err);
    return res.status(500).json({ error: "Erreur lors de l'envoi de l'email. Réessaie dans un instant." });
  }
};
