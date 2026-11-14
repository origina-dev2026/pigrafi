// Email di conferma e ringraziamento inviata all'agenzia dopo la registrazione (via Brevo API).
export function confirmationEmail({ name, contact_name }) {
  const subject = 'Registrazione ricevuta: grazie per aver aderito a Pigrafi';
  const text = [
    `Gentile ${contact_name || 'referente'},`,
    '',
    `abbiamo ricevuto la registrazione di ${name} a Pigrafi. Grazie per la fiducia.`,
    '',
    'Abbiamo registrato anche la vostra autorizzazione alla pubblicazione dei manifesti, con la data e il testo accettato.',
    'Vi contatteremo a breve per completare la configurazione della vostra pagina dei necrologi.',
    '',
    'Per revocare l’autorizzazione in qualsiasi momento, scrivete a collaborazioni@majime.it.',
    '',
    'Cordiali saluti,',
    'Collaborazioni Pigrafi',
    'collaborazioni@majime.it',
  ].join('\n');
  return { subject, text };
}

// invio tramite API Brevo; non blocca la registrazione se fallisce
export async function sendConfirmation(env, data) {
  if (!env.BREVO_API_KEY) return { sent: false, reason: 'BREVO_API_KEY non impostata' };
  const { subject, text } = confirmationEmail(data);
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Collaborazioni Pigrafi', email: 'collaborazioni@majime.it' },
      to: [{ email: data.email, name: data.contact_name }],
      subject,
      textContent: text,
    }),
  });
  return { sent: res.ok, status: res.status };
}

// avviso interno: una email a collaborazioni@majime.it per ogni nuova registrazione
export async function sendInternalNotice(env, data) {
  if (!env.BREVO_API_KEY) return { sent: false, reason: 'BREVO_API_KEY non impostata' };
  const text = [
    'Nuova registrazione agenzia su Pigrafi',
    '',
    `Agenzia: ${data.name}`,
    `Referente: ${data.contact_name}`,
    `Email: ${data.email}`,
    `Telefono: ${data.phone || '-'}`,
    `Città: ${data.city}`,
    `Sito: ${data.website || '-'}`,
    `Pagina necrologi: ${data.necrologi_url}`,
    `Pagina anniversari: ${data.anniversari_url || '-'}`,
  ].join('\n');
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Pigrafi', email: 'collaborazioni@majime.it' },
      to: [{ email: 'collaborazioni@majime.it' }],
      subject: `Nuova registrazione: ${data.name} (${data.city})`,
      textContent: text,
    }),
  });
  return { sent: res.ok, status: res.status };
}
