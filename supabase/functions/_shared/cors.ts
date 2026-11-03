// Cabeçalhos CORS das funções chamadas a partir da app (browser e app nativa).
// A autorização é feita pelo token do utilizador (Authorization), não pela origem.

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

/** Resposta ao pedido de verificação (preflight) do browser. */
export function preflight(): Response {
  return new Response('ok', { headers: corsHeaders });
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}
