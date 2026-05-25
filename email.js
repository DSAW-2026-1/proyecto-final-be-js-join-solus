const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@marketplacesabana.com'
const FROM_NAME = process.env.FROM_NAME || 'Marketplace Sabana'

async function withTimeout(promise, ms, label) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  })
  return Promise.race([promise.finally(() => clearTimeout(timer)), timeout])
}

async function sendWithRetry(fn, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === retries) throw err
      await new Promise((r) => setTimeout(r, attempt * 500))
    }
  }
}

export async function sendEmail({ to, subject, html, text }) {
  if (!SENDGRID_API_KEY) {
    console.log(`[EMAIL SIMULADO] Para: ${to} | Asunto: ${subject}`)
    return { status: 'simulated' }
  }

  return sendWithRetry(async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: FROM_EMAIL, name: FROM_NAME },
        subject,
        content: [{ type: 'text/html', value: html }],
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer))

    if (!res.ok) {
      const errText = await res.text()
      console.error(`[SENDGRID ERROR] ${res.status}: ${errText}`)
      return { status: 'error', detail: errText }
    }

    return { status: 'sent' }
  }).catch((err) => {
    console.error('[SENDGRID ERROR]', err.message)
    return { status: 'error', detail: err.message }
  })
}

export function welcomeEmail(name) {
  return {
    subject: '¡Bienvenido a Marketplace Sabana!',
    html: `
      <div style="font-family: system-ui; max-width: 600px; margin: 0 auto;">
        <div style="background: #071B60; padding: 2rem; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 1.5rem;">Marketplace Sabana</h1>
        </div>
        <div style="background: #F8F6FF; padding: 2rem; border-radius: 0 0 12px 12px;">
          <h2 style="color: #071B60;">¡Hola, ${name}!</h2>
          <p style="color: #4B5563; line-height: 1.6;">Gracias por registrarte en Marketplace Sabana, el lugar seguro para comprar y vender entre la comunidad de la Universidad de La Sabana.</p>
          <p style="color: #4B5563; line-height: 1.6;">Ya puedes explorar productos, agregar a favoritos y conectar con otros miembros de la comunidad.</p>
          <div style="text-align: center; margin: 2rem 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/explore" style="background: #071B60; color: white; padding: 0.75rem 2rem; text-decoration: none; border-radius: 8px; font-weight: 600;">Explorar productos</a>
          </div>
          <p style="color: #6B7280; font-size: 0.85rem;">Si tienes alguna pregunta, responde a este correo.</p>
        </div>
      </div>
    `,
  }
}

export function orderConfirmationEmail(name, orderId, items, total) {
  const itemsHtml = items.map((i) => `
    <tr>
      <td style="padding: 0.5rem; border-bottom: 1px solid #EEF2FF;">${i.title}</td>
      <td style="padding: 0.5rem; border-bottom: 1px solid #EEF2FF; text-align: center;">${i.quantity}</td>
      <td style="padding: 0.5rem; border-bottom: 1px solid #EEF2FF; text-align: right;">$${i.price.toLocaleString('es-CO')}</td>
    </tr>
  `).join('')

  return {
    subject: `Orden #${orderId} confirmada - Marketplace Sabana`,
    html: `
      <div style="font-family: system-ui; max-width: 600px; margin: 0 auto;">
        <div style="background: #071B60; padding: 2rem; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 1.5rem;">¡Orden confirmada!</h1>
        </div>
        <div style="background: #F8F6FF; padding: 2rem; border-radius: 0 0 12px 12px;">
          <h2 style="color: #071B60;">Gracias por tu compra, ${name}</h2>
          <p style="color: #4B5563;">Tu orden <strong>#${orderId}</strong> ha sido confirmada exitosamente.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 1.5rem 0;">
            <thead>
              <tr style="background: #EEF2FF;">
                <th style="padding: 0.75rem; text-align: left;">Producto</th>
                <th style="padding: 0.75rem; text-align: center;">Cantidad</th>
                <th style="padding: 0.75rem; text-align: right;">Precio</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
            <tfoot>
              <tr>
                <td colspan="2" style="padding: 0.75rem; font-weight: 600; text-align: right;">Total:</td>
                <td style="padding: 0.75rem; font-weight: 600; text-align: right;">$${total.toLocaleString('es-CO')}</td>
              </tr>
            </tfoot>
          </table>
          <div style="text-align: center; margin: 2rem 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders" style="background: #071B60; color: white; padding: 0.75rem 2rem; text-decoration: none; border-radius: 8px; font-weight: 600;">Ver mis órdenes</a>
          </div>
        </div>
      </div>
    `,
  }
}

export function sellerSaleNotification(name, buyerName, orderId, items) {
  const itemsHtml = items.map((i) => `<li style="color: #4B5563;">${i.title} x${i.quantity}</li>`).join('')
  return {
    subject: `¡Venta realizada! #${orderId} - Marketplace Sabana`,
    html: `
      <div style="font-family: system-ui; max-width: 600px; margin: 0 auto;">
        <div style="background: #071B60; padding: 2rem; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 1.5rem;">¡Nueva venta!</h1>
        </div>
        <div style="background: #F8F6FF; padding: 2rem; border-radius: 0 0 12px 12px;">
          <h2 style="color: #071B60;">¡Felicidades, ${name}!</h2>
          <p style="color: #4B5563;"><strong>${buyerName}</strong> ha comprado tus productos (Orden #${orderId}).</p>
          <ul style="margin: 1rem 0;">${itemsHtml}</ul>
          <p style="color: #6B7280; font-size: 0.85rem;">Coordina la entrega a través de la mensajería interna del Marketplace.</p>
        </div>
      </div>
    `,
  }
}

export async function sendWelcomeEmail(email, name) {
  const { subject, html } = welcomeEmail(name)
  return sendEmail({ to: email, subject, html })
}

export async function sendOrderConfirmation(email, name, orderId, items, total) {
  const { subject, html } = orderConfirmationEmail(name, orderId, items, total)
  return sendEmail({ to: email, subject, html })
}

export async function sendSellerNotification(email, sellerName, buyerName, orderId, items) {
  const { subject, html } = sellerSaleNotification(sellerName, buyerName, orderId, items)
  return sendEmail({ to: email, subject, html })
}
