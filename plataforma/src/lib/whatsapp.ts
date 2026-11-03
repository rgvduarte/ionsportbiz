// Envio por WhatsApp: abre o WhatsApp de quem envia com a mensagem já escrita (wa.me).
// Não há envio automático: a pessoa da equipa confirma o envio no próprio WhatsApp.

/** https://wa.me/351912345678?text=… — o número em E.164 (o "+" e os separadores são removidos). */
export function whatsappUrl(phoneE164: string, text: string): string {
  const digits = (phoneE164 ?? '').replace(/\D/g, '');
  const query = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${digits}${query}`;
}

/** O WhatsApp aceita mensagens longas, mas acima disto deixam de ser práticas para ler no telemóvel. */
export const WHATSAPP_COMFORTABLE_LENGTH = 700;
