// api/create-preference.js
// Función serverless (Vercel/Netlify) que crea una preferencia de pago en Mercado Pago.
// El ACCESS TOKEN nunca se escribe aquí: se lee de la variable de entorno MP_ACCESS_TOKEN.
// El dinero llega a la cuenta dueña de ese token.

export default async function handler(req, res) {
  // --- CORS: permitir que tu landing (GitHub Pages) llame a esta función ---
  const allowed = [
    'https://fmrcolombia.com',
    'https://www.fmrcolombia.com',
    'https://kcramirezariza-cmyk.github.io'
  ];
  const origin = req.headers.origin;
  if (allowed.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ error: 'Falta la variable MP_ACCESS_TOKEN en el servidor' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const items = body.items;
    const payer = body.payer;

    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ error: 'El carrito está vacío' });

    const preference = {
      items: items.map((i) => ({
        title: String(i.title || 'Producto FMR').slice(0, 250),
        quantity: Math.max(1, parseInt(i.quantity, 10) || 1),
        unit_price: Math.round(Number(i.unit_price) || 0),
        currency_id: 'COP'
      })),
      back_urls: {
        success: 'https://fmrcolombia.com/?pago=exito',
        failure: 'https://fmrcolombia.com/?pago=error',
        pending: 'https://fmrcolombia.com/?pago=pendiente'
      },
      auto_return: 'approved',
      statement_descriptor: 'FMR COLOMBIA'
    };
    if (payer && payer.name) preference.payer = { name: String(payer.name).slice(0, 100) };

    // Validación básica de montos
    const bad = preference.items.find((i) => !(i.unit_price > 0));
    if (bad) return res.status(400).json({ error: 'Hay un producto con precio inválido' });

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(preference)
    });
    const data = await mpRes.json();

    if (!mpRes.ok) {
      console.error('MP error', data);
      return res.status(502).json({ error: 'Mercado Pago rechazó la solicitud', detail: data.message || data });
    }

    return res.status(200).json({ init_point: data.init_point, id: data.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno', detail: String(err) });
  }
}
