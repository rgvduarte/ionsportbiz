# Apps iOS e Android

As apps são a mesma aplicação web, empacotada com [Capacitor 8](https://capacitorjs.com). Não há uma segunda base de código: o que se altera em `src/` passa para as apps no próximo build.

| Pasta / ficheiro | Conteúdo |
| --- | --- |
| `capacitor.config.ts` | Identificador, nome, ecrã inicial e barra de estado |
| `ios/` | Projeto Xcode (dependências por CocoaPods) |
| `android/` | Projeto Android Studio (Gradle) |
| `src/native/` | Integração: leitor QR nativo, links profundos, barra de estado, botão "voltar" |
| `public/.well-known/` | Modelos para Universal Links (iOS) e App Links (Android) |

## O que as apps fazem

**Convidados** (ecrã inicial "Os meus convites", sem conta nem palavra-passe):

- Guardam os convites abertos na app (ao tocar no link do email ou do WhatsApp, ou ao ler o QR do convite com a câmara).
- Mostram o convite, permitem confirmar ou recusar presença e indicar acompanhantes.
- Depois de confirmar, mostram o bilhete com o código QR para a entrada.
- A lista de convites guardados (nome e data do evento) fica disponível sem rede. No telemóvel guarda-se só o token do link e essa cópia do nome e da data. No Android, os convites guardados não vão para a cópia de segurança na nuvem (`allowBackup="false"`), porque o link pessoal funciona como credencial.

**Equipa** (botão "Acesso da equipa"):

- Check-in à porta com o leitor de códigos nativo (Google ML Kit): abre em ecrã inteiro e lê o QR do bilhete de forma rápida e fiável, também com pouca luz. No Android usa o leitor dos Google Play Services, que não precisa da permissão da câmara.
- Pesquisa por nome, entidade ou acompanhante, e introdução manual do código de 10 caracteres.
- Quem tem o papel Receção só vê o check-in (nunca o CRM). Os restantes papéis veem o back-office como no browser.

No browser o check-in também funciona (câmara através da página, em https), por isso as apps não são obrigatórias para a porta: são uma conveniência e um canal oficial para os convidados.

## Pré-requisitos

| | iOS (App Store) | Android (Google Play) |
| --- | --- | --- |
| Conta | Apple Developer Program, **99 USD por ano** | Google Play Console, **25 USD** (pagamento único) |
| Tipo de conta recomendado | **Organização** (a app aparece em nome da entidade). Exige número D-U-N-S, gratuito, que pode demorar alguns dias a obter | **Organização**. Exige número D-U-N-S e verificação da entidade |
| Computador | **Mac** com a versão atual do Xcode (a Apple exige o SDK mais recente para novas submissões) e CocoaPods | Qualquer sistema com Android Studio e JDK 21 |
| Testes | TestFlight (até 10 000 testadores) | Testes internos, fechados e abertos |

**Atenção às contas pessoais no Google Play:** as contas de programador pessoais criadas recentemente têm de fazer um **teste fechado com pelo menos 12 testadores durante 14 dias seguidos** antes de poderem publicar em produção. As contas de organização não têm esta exigência. Por isso, e porque a app deve aparecer em nome da entidade, use uma conta de organização nas duas lojas.

## Identificador da app

O identificador é `com.ionsportsbiz.convidados` (domínio invertido de ionsportsbiz.com). **Depois do primeiro envio para as lojas não pode ser alterado**: uma app com outro identificador é, para as lojas, uma app diferente.

Se for preciso mudá-lo antes do primeiro envio, os locais são:

1. `capacitor.config.ts` → `appId`.
2. `android/app/build.gradle` → `namespace` e `applicationId`.
3. `android/app/src/main/res/values/strings.xml` → `package_name` e `custom_url_scheme`.
4. `android/app/src/main/java/com/ionsportsbiz/convidados/MainActivity.java` → mover para a pasta do novo pacote e corrigir a linha `package`.
5. Xcode → alvo **App** → *Signing & Capabilities* → *Bundle Identifier* (fica em `ios/App/App.xcodeproj/project.pbxproj`, `PRODUCT_BUNDLE_IDENTIFIER`).
6. `public/.well-known/apple-app-site-association` (`appIDs`) e `public/.well-known/assetlinks.json` (`package_name`).

O nome visível (`ion Convidados`) muda em `capacitor.config.ts` (`appName`), em `android/app/src/main/res/values/strings.xml` (`app_name`, `title_activity_main`) e em `ios/App/App/Info.plist` (`CFBundleDisplayName`).

## Construir as apps

1. Configurar o `.env` (ver `.env.example`). Nas apps, **`VITE_PUBLIC_URL` é obrigatório**: a origem das apps é `capacitor://localhost` (iOS) ou `https://localhost` (Android), por isso os links pessoais e os links de acesso têm de usar o domínio público.
2. Construir e copiar para os projetos nativos:

   ```bash
   npm run cap:sync        # npm run build + npx cap sync
   ```

3. **iOS** (no Mac):

   ```bash
   sudo gem install cocoapods      # ou: brew install cocoapods
   cd ios/App && pod install && cd ../..
   npx cap open ios                # abre App.xcworkspace (nunca o .xcodeproj)
   ```

   No Xcode: *Signing & Capabilities* → escolher a equipa (Team) da entidade; confirmar a capacidade *Associated Domains* (vem de `ios/App/App/App.entitlements`). Para publicar: *Product → Archive → Distribute App → App Store Connect*.

   O plugin de leitura de códigos (ML Kit) só suporta CocoaPods, por isso o projeto iOS foi criado com CocoaPods e não com Swift Package Manager (o modo por omissão do Capacitor 8). A versão mínima é iOS 15.5, exigida pelo ML Kit.

4. **Android**:

   ```bash
   npx cap open android
   ```

   No Android Studio: *Build → Generate Signed App Bundle* (formato `.aab`). Ative o **Play App Signing** na consola: a Google guarda a chave de assinatura da app; a entidade guarda apenas a chave de envio (*upload key*) — guarde-a num cofre de palavras-passe, com cópia de segurança.

5. **Versões:** cada envio tem de ter um número de build maior. iOS: *General → Version / Build* no Xcode. Android: `versionName` e `versionCode` em `android/app/build.gradle`.

Durante o desenvolvimento, para testar no telemóvel com recarregamento automático, pode apontar temporariamente a app para o servidor Vite (`server.url` em `capacitor.config.ts`). Nunca publique com essa opção ativa.

## Links que abrem a app (Universal Links e App Links)

Com isto, o link pessoal `https://<domínio>/c/<token>` enviado por email ou WhatsApp abre diretamente na app, se estiver instalada (senão abre no browser, como sempre). O mesmo acontece com os links `https://<domínio>/admin…`.

1. O domínio é `ionsportbiz.app`, já configurado em:
   - `android/app/src/main/AndroidManifest.xml` (filtro com `android:autoVerify="true"`);
   - `ios/App/App/App.entitlements` (`applinks:ionsportbiz.app`).
2. Preencher os modelos em `public/.well-known/` (são publicados com o site):
   - `apple-app-site-association`: substituir `TEAMID` pelo *Team ID* da Apple (10 caracteres, em *developer.apple.com → Membership*), seguido de um ponto e do identificador da app.
   - `assetlinks.json`: substituir o texto `SHA256_…` pela impressão digital SHA-256 do **certificado de assinatura da app** (Play Console → *Configuração → Integridade da app → Assinatura de apps*). Para testar builds locais, acrescentar também a da chave de envio.
3. Os dois ficheiros têm de ser servidos em `https://<domínio>/.well-known/…`, **sem redirecionamentos** e com `Content-Type: application/json`. Em Netlify ou Cloudflare Pages, um ficheiro `public/_headers`:

   ```
   /.well-known/apple-app-site-association
     Content-Type: application/json
   ```

4. Verificar:
   - Android: `adb shell pm verify-app-links --re-verify <appId>` e `adb shell pm get-app-links <appId>` (deve indicar `verified`).
   - iOS: a Apple guarda uma cópia em cache; consultar `https://app-site-association.cdn-apple.com/a/v1/<domínio>`. As alterações podem demorar até um dia a propagar.

Esquema próprio para testes: `convites://c/<token>`.

```bash
adb shell am start -a android.intent.action.VIEW -d "convites://c/<token>"
xcrun simctl openurl booted "convites://c/<token>"
```

**Acesso da equipa na app.** Na app, a equipa entra com email e palavra-passe. Os links de acesso por email (convite da equipa, "Receber link de acesso") também iniciam sessão na app quando abrem diretamente nela, porque `src/native/init.ts` lê as credenciais do link. Atenção: os modelos de email por omissão do Supabase passam primeiro pelo domínio `supabase.co`, e os telemóveis nem sempre abrem a app a partir de um redirecionamento; nesses casos o link abre no browser. Para a porta, recomenda-se que cada pessoa da Receção defina uma palavra-passe.

## Ícone e ecrã inicial

Os projetos usam os ícones e o ecrã inicial genéricos do Capacitor. Para gerar os da entidade:

1. Criar a pasta `assets/` com `icon-only.png` (1024×1024, sem transparência), `icon-foreground.png` e `icon-background.png` (ícone adaptativo Android, 1024×1024) e `splash.png` (2732×2732, logótipo centrado sobre `#13294b`).
2. Instalar e correr o gerador oficial: `npm install -D @capacitor/assets` e `npx capacitor-assets generate`.

A cor do ecrã inicial e da barra de estado (`#13294b`) está em `capacitor.config.ts`. O ecrã inicial só desaparece quando a app desenha o primeiro ecrã (máximo de 4 segundos).

## Revisão nas lojas

**Notas para a equipa de revisão** (App Store Connect → *App Review Information*; Play Console → *Acesso à app*): a revisão precisa de ver tudo sem ajuda. Forneça:

- uma conta de teste com o papel **Receção** (email e palavra-passe) e indicação do evento de teste;
- um link ou código de convite de teste já confirmado, para verem o bilhete;
- uma frase a explicar o contexto: "App de convites para eventos institucionais por convite. Os convidados recebem um link pessoal; a equipa da organização faz o check-in à porta. Não há vendas nem conteúdos pagos."

**Apple 4.2 — funcionalidade mínima.** A Apple recusa apps que sejam apenas um site dentro de uma moldura. Argumentos desta app: leitor de códigos nativo (ML Kit) para a porta, convites guardados no dispositivo e disponíveis sem rede, abertura direta dos links pessoais (Universal Links), barra de estado e navegação nativas. Recomenda-se, antes da primeira submissão, guardar também no dispositivo o código do bilhete, para o convidado o poder mostrar à entrada mesmo sem rede.

**Apple 5.1.1(v) — eliminação de conta.** Esta regra aplica-se a apps que permitem criar conta. Aqui:

- os convidados não têm conta; podem pedir a eliminação dos seus dados no próprio convite ("Pedir eliminação dos dados"), e o pedido fica registado para a organização tratar;
- as contas da equipa não são criadas na app: são criadas por um administrador da entidade. Para eliminar uma conta, a pessoa pede ao administrador, que a desativa em *Equipa* (o acesso termina de imediato) e, se for pedida a eliminação definitiva, apaga o utilizador no Supabase (*Authentication → Users → Delete user*; a linha da equipa é apagada em cascata e o histórico fica sem o nome).

Explique isto nas notas de revisão e na política de privacidade.

**Política de privacidade.** As duas lojas exigem um endereço público. Use a política da entidade (o mesmo endereço configurado em cada evento).

## Privacidade nas lojas (App Privacy e Segurança dos dados)

Declarar com rigor. Sem publicidade, sem rastreio entre apps e sem ferramentas de análise de terceiros. Os dados vão cifrados (HTTPS) para o servidor da entidade (Supabase, região UE).

| Dado | Quem | Finalidade | Ligado à identidade |
| --- | --- | --- | --- |
| Nome | Convidados (vem do convite) e equipa | Funcionalidade da app | Sim |
| Email | Equipa (início de sessão); convidados, se constar do convite | Funcionalidade da app | Sim |
| Telefone | Convidados, se constar do convite | Funcionalidade da app | Sim |
| Conteúdo do utilizador | Resposta ao convite, nomes dos acompanhantes, respostas ao formulário e mensagem | Funcionalidade da app | Sim |
| Outros dados | Consentimento para comunicações futuras (opcional) | Funcionalidade da app | Sim |

- **Câmara:** usada só para ler códigos QR no dispositivo; as imagens não são guardadas nem enviadas. Não é uma recolha de dados a declarar, mas é pedida permissão com a explicação "A câmara é usada para ler o código QR dos convites e dos bilhetes."
- **Não acedidos:** contactos do telemóvel, localização, fotografias, calendário (o "Adicionar ao calendário" usa a partilha do sistema), identificadores de publicidade.
- **Dados sensíveis:** se um evento pedir necessidades de acessibilidade ou restrições alimentares por motivos de saúde, avalie declarar também "Informação sensível / saúde".
- **Google Play:** "Os dados são encriptados em trânsito: Sim"; "Os utilizadores podem pedir a eliminação dos dados: Sim" (pelo próprio convite, ou junto da entidade).

## Lista de verificação para publicar

- [ ] Identificador definitivo aplicado em todos os locais (ver acima) — **antes** do primeiro envio.
- [ ] `.env` de produção com `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_PUBLIC_URL`.
- [ ] Domínio real no `AndroidManifest.xml`, em `App.entitlements` e nos ficheiros `.well-known`, publicados e verificados.
- [ ] No Supabase, `<VITE_PUBLIC_URL>/admin` está nos *Redirect URLs*.
- [ ] Ícone, ecrã inicial e nome da app da entidade.
- [ ] Versão e número de build atualizados.
- [ ] Testado em iPhone e Android reais: abrir link pessoal, confirmar presença, ver bilhete, ler QR à porta (com pouca luz), botão "voltar" no Android, sem rede.
- [ ] Conta e convite de teste para a revisão, com instruções.
- [ ] Política de privacidade publicada; App Privacy (Apple) e Segurança dos dados (Google) preenchidos.
- [ ] Capturas de ecrã (iPhone 6,9", iPad 13" se suportar iPad; Android telemóvel e tablet).
- [ ] Android: Play App Signing ativo e chave de envio guardada com cópia de segurança.
- [ ] Publicação faseada (*phased release* / lançamento progressivo) ativada.
