// Responde 410 Gone en el host de la antigua tienda (tienda.deterrajaras.es).
// Se usa mediante un rewrite condicionado por host en vercel.json.
module.exports = (req, res) => {
  res.statusCode = 410;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('Esta tienda ya no está disponible.');
};
