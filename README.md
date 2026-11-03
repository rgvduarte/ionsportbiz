# ion Convidados

Plataforma de convidados da **ion — International Business & Sports Conference**. Gestão de convidados para eventos por convite: CRM de contactos, listas de convidados por evento, envio de convites (email e WhatsApp), página pessoal do convidado com confirmação de presença e bilhete QR, check-in à porta e apps iOS/Android.

**Demonstração:** https://ionsportbiz.app (dados fictícios; entrar com `admin@demo.pt` e qualquer palavra-passe).

## Como funciona

```
 Equipa (back-office /admin)                    Convidado (link pessoal /c/<token>)
 ───────────────────────────                    ─────────────────────────────────────
 Contactos (CRM) ──► Convites por evento ──►    abre o convite ──► confirma / recusa
        ▲               │  email / WhatsApp            │              (+ acompanhantes,
        │               ▼                              ▼               respostas, consentimento)
   importação CSV   Painel: funil, vagas,        bilhete com QR ──► Check-in à porta
                    segmentos, atividade                              (app ou web, papel Receção)
```

- **O convidado não cria conta.** O link pessoal (122 bits aleatórios) é a credencial e só dá acesso ao próprio convite, através de funções SQL com permissões controladas.
- **Papéis da equipa:** Administrador, Editor, Receção (só check-in, não vê o CRM) e Leitura.
- **RGPD:** consentimento para comunicações futuras separado e opcional, guardado com o texto e a data; exportação dos dados de uma pessoa; apagamento (anonimização) que mantém os números agregados; pedidos de eliminação feitos pelo próprio convidado ficam registados.

## Modo demonstração

Sem Supabase configurado, a app arranca com dados fictícios guardados no browser. Serve para ver e testar tudo antes de haver backend.

```bash
npm install
npm run dev          # http://localhost:5173 — entrar com admin@demo.pt (qualquer palavra-passe)
```

Outros papéis: `editor@demo.pt`, `porta@demo.pt` (receção), `leitura@demo.pt`.

## Instalação com Supabase

1. **Criar o projeto** em [supabase.com](https://supabase.com), na região **EU (Frankfurt)**.
2. **Aplicar o esquema:** no SQL Editor, correr `supabase/migrations/20261103000000_init.sql`
   (ou, com a CLI: `supabase link` e `supabase db push`).
3. **Autenticação:** em *Authentication → URL Configuration*, definir o *Site URL* para o endereço público da app e acrescentar `<endereço>/admin` aos *Redirect URLs*. Desligar *Allow new users to sign up* (as contas da equipa são criadas por convite).
4. **Primeiro administrador:** em *Authentication → Users → Invite user*, convidar o seu email. Depois, no SQL Editor:

   ```sql
   insert into public.staff (user_id, full_name, email, role)
   select id, 'O Seu Nome', email, 'admin' from auth.users where email = 'o.seu@email.pt';
   ```

   Os restantes membros são convidados a partir de *Equipa* no back-office.
5. **Variáveis da app:** copiar `.env.example` para `.env` e preencher `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_PUBLIC_URL`.
6. **Funções (envio de emails e convites da equipa):**

   ```bash
   supabase functions deploy send-invitations
   supabase functions deploy invite-staff
   supabase secrets set PUBLIC_URL=https://ionsportbiz.app \
     BREVO_API_KEY=… MAIL_FROM_EMAIL=convites@exemplo.pt MAIL_FROM_NAME="Nome da entidade"
   ```

   O remetente tem de estar validado no Brevo (SPF e DKIM do domínio), senão os convites caem no spam.

## Alojamento

A demonstração é publicada no GitHub Pages pelo workflow `.github/workflows/pages.yml` a cada push para `main` (em *Settings → Pages*, a fonte tem de ser *GitHub Actions*). A versão de produção deve ficar num domínio da entidade, ligada ao Supabase.

A app é estática (`npm run build` gera `dist/`). Qualquer alojamento serve; recomenda-se um com reescrita de rotas para `index.html` (Cloudflare Pages, Netlify, Vercel). Em alojamentos sem reescrita (GitHub Pages) o build já inclui um `404.html` que encaminha as rotas.

O domínio deve ser da entidade (ex.: `convites.entidade.pt`): é o que aparece nos links enviados aos convidados.

## Apps iOS e Android

Ver [docs/apps-nativas.md](docs/apps-nativas.md).

## Desenvolvimento

```bash
npm run dev          # servidor de desenvolvimento
npm run typecheck    # TypeScript
npm test             # testes unitários (Vitest)
npm run test:db      # esquema, RLS e funções SQL num Postgres local temporário
npm run build        # build de produção
node scripts/shot.mjs /admin captura.png --as=admin@demo.pt   # captura de ecrã em modo demonstração
```

Estrutura:

| Pasta | Conteúdo |
| --- | --- |
| `supabase/migrations` | Esquema, RLS e funções SQL |
| `supabase/functions` | Funções Deno: `send-invitations`, `invite-staff`, `_shared` (modelos de mensagem e email) |
| `src/lib/api` | Contrato de dados (`types.ts`) com duas implementações: `supabase/` e `demo/` |
| `src/admin` | Back-office |
| `src/guest` | Página do convidado e início da app |
| `src/native` | Integração Capacitor (leitor QR, links profundos) |
| `src/ui` | Componentes e sistema de design |
