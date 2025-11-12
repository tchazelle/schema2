function buildUrl(req, relativeUrl) {
  // Déduire le protocole (http ou https)
  const protocol = req.protocol;
  
  // Déduire le host (nom de domaine + port)
  const host = req.get('host');

  // Vérifie si l'URL est déjà absolue
  if (/^https?:\/\//i.test(relativeUrl)) {
    return relativeUrl;
  }

  // Concatène proprement
  return `${protocol}://${host.replace(/\/$/, '')}/${relativeUrl.replace(/^\//, '')}`;
}
module.exports = { buildUrl };