# Auditoria de prontidão para lançamento — 12/10/2026

## Rodada final de dependências e empacotamento — 12/10/2026

Esta seção substitui as contagens das rodadas abaixo, preservadas como histórico.
Gabriel decidiu fazer login/assinatura/build do APK pessoalmente; o roteiro está
em `app-mobile/app-mastergreen/docs/GERAR-APK.md`. Nenhum APK/conta/chave/produção
foi alterado. EAS whoami retornou Not logged in; CLI consultada: 24.13.0.

### Entregue nesta rodada

- Web: Vercel/adapter e plugin Tailwind são dependências de desenvolvimento.
  Runtime separado do Vite; build usa chunks e importação dev sob demanda.
  Docker instala somente dependências de produção, executa como node (não root),
  tem /health e usa Node 22 Bookworm slim. NODE_IMAGE pode receber digest aprovado.
  Migrações são etapa administrativa explícita, não db:push no runtime.
- `npm audit --omit=dev` web: **0 vulnerabilidades** (antes 45).
  Auditoria completa ainda acusa 51 pacotes: 39 high, 11 moderate, 1 low;
  pertencem ao conjunto de ferramentas excluído do runtime. Não foram ocultados
  por exceção de scanner nem corrigidos à força.
- Mobile: decode-uri-component 0.5.0 corrige DoS no parsing de URLs. Patch
  reproduzível ajusta a interoperabilidade de query-string 7 (CommonJS) com ESM;
  postinstall falha se não conseguir aplicar. Testes verificam acentos, arrays,
  links do app e entrada malformada em processo isolado com timeout.
- UUID do xcode atualizado para 11.1.1 com override restrito. Teste cobre geração
  de identificadores no formato esperado. Sem alteração no fluxo de propostas.
- `.easignore`/`.gitignore` protegem envs e chaves; upload real ainda deve passar
  por build:inspect antes de enviar ao EAS, especialmente pelo repositório aninhado.

### Alertas remanescentes: avaliação, não promessa de risco zero

Mobile omit-dev: **19 high, 0 moderate, 0 critical**; incluindo ferramentas dev:
21 high. São cadeias de dependência de **dois avisos-raiz sem versão corrigida
publicada na consulta**: braces <=3.0.3 (padrões profundamente aninhados/DoS),
node-forge <=1.4.0 (verificação RSA de assinaturas). Expo instala CLI/Metro junto
de suas dependências, por isso omit-dev não representa sozinho o APK.

Mapa do export Hermes: 1.346 fontes; **braces/node-forge/uuid ausentes**;
query-string e decodificador corrigido presentes. Isso demonstra ausência no
bundle JavaScript inspecionado, não auditoria dos binários nativos do futuro APK.

Mitigação: toolchain executado somente com código/padrões confiáveis, Metro nunca
exposto em produção, assinatura Android original preservada, não habilitar OTA
ou aceitar certificados de terceiros. Chave Android é distinta da biblioteca
de certificados do Expo. Acompanhar correções upstream antes de nova build;
aceite explícito do risco residual de build continua necessário para lançamento.

Referências: [decoder](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr),
[braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
[node-forge](https://github.com/advisories/GHSA-86w9-cpqp-85rv).

### Evidências repetidas

- TypeScript web/mobile, lint mobile: passaram; web 25 testes, mobile 30 testes.
- Build web e export Android/Hermes com source map: passaram.
- Instalação isolada npm ci --omit=dev (359 pacotes): servidor iniciou em modo
  production contra mastergreen_develop, sem Vite/Vercel/Tailwind/tsx;
  health/SPA 200, APIs protegidas 401. Script `npm run test:runtime`.
- Docker Desktop está sem daemon Linux: **a imagem Linux/Node22 não foi construída
  nem homologada**. O smoke isolado rodou no Windows/Node24 e não substitui isso.
- Integração: 10.488 verificações, zero divergências, omissões ou chaves duplicadas;
  segurança HTTP local passou novamente. Nenhum teste conectado ao banco oficial.
- Seis fluxos de navegador passaram. Uma execução offline falhou com diagnóstico
  mascarado por escopo da variável page no catch; diagnóstico corrigido, repetição
  completa passou. Não foi possível atribuir a causa original; manter atenção a
  flakiness. O teste usa rede simulada, não Android físico.
- Aviso de bundle web grande permanece como melhoria de performance, sem falha
  funcional observada. Não foi suprimido.

**Conclusão:** verificações locais aprovadas; ainda não declarar versão lançada.
Faltam URL/deploy HTTPS, backup/migrações/proxy em homologação, aceite dos riscos
de toolchain, assinatura/versionCode, build APK pelo usuário e roteiro Android.

## Atualização após implementação — 12/10/2026

O parecer abaixo desta seção registra a auditoria inicial, **antes das correções**.
Esta atualização é histórica; a rodada final acima é o estado mais recente. Alterações locais em `develop` nos dois
repositórios; sem commit, push, deploy, escrita comercial em produção ou APK publicado.

### Corrigido e verificado

- App continua simplificado, sem editor completo: cálculo rápido e histórico de
  consulta. Edição de itens, custos e condições permanece no web.
- Endereço enviado completo (número, bairro e CEP); seleção mantém customerId.
  API valida o vínculo e não cria outro cadastro se o cliente escolhido deixou
  de existir. Teste transacional cobre cliente sem documento/telefone e reenvio.
- Dashboard, extrato e lista administrativa usam a mesma seleção de propostas
  dos relatórios/mobile, sem duplicar versões. Funcionários conservam seu escopo.
  Custos/lucro só onde registrados, preservando zero/prejuízo. Comissões são
  identificadas como estimativas, não pagamentos.
- Resumo renova ao receber foco e após sincronização bem-sucedida, inclusive se
  custos mudaram sem alterar o total do histórico. Cache por período é preservado.
- Histórico identifica o PDF do aparelho como **cópia original** e oferece
  **Ver versão atual no web** para propostas App já sincronizadas. Link protegido
  `/orcamentos?view=UUID&source=app` mantém destino após login e usa dados atuais.
  Não há token na URL, link público ou nova edição dentro do app.
- Navegação web-preview libera foco antes de ocultar a tela e transfere foco ao
  título de destino. Teste passou capturando também avisos aria-hidden/foco.
- Erro JSON não derruba mais o servidor nem devolve stack; respostas API sem
  cache e sem password/token_hash, inclusive em usuários aninhados nas propostas.
  Login web limita tentativas; cookies HttpOnly/SameSite=Lax e Secure em produção.
  Produção usa sessões PostgreSQL, com migração explícita 0005 (não aplicada em produção).

### Evidências desta rodada

| Verificação | Resultado |
|---|---|
| TypeScript web/mobile e lint mobile | Passou |
| Regras/contratos/integração web | 25 testes passaram, incluindo store de sessão em tabela temporária com rollback |
| Regras/estado/PDF/link/configuração mobile | 27 testes passaram |
| Navegador com APIs sintéticas | 6 fluxos passaram: UX mobile, offline, editor web, filtros, link Web e link App |
| HTTP local de segurança | Passou: acesso anônimo bloqueado, token inválido/revogado, expiração 30 dias, JSON inválido, payload inválido, cookies e ausência de hashes |
| Conferência banco/API | 10.488 verificações; mismatches=[] e dashboardDifferences=[]; exit 0 |
| Amostra de integração | 288 clientes, 76 produtos, 126 detalhadas, 7 rápidas, 133 no histórico; lista admin web também com 126 |
| Endereço omitido / vínculo ausente / retry duplicado | Zero na amostra; 1 cliente sem CPF/telefone preservado por ID |
| Build web | Passou; continua aviso de bundle grande, não tratado como erro funcional |
| Expo install --check | Dependências compatíveis com SDK 57 |
| Export Android produção | Passou: 1.356 módulos e bundle Hermes .hbc (~3 MB), não é APK assinado |
| PDF após jsPDF atualizado | Curto/resumo/múltiplas páginas gerados; renderização web curta e página intermediária longa inspecionadas; sem cortes/colisões na amostra |

Offline: login, rascunho após recarregar, salvar sem conexão, expiração/renovação,
envio único, logout/reentrada e fonte extragrande passaram no navegador. UX cobre
retorno ao resumo com valores novos, seleção de cliente/produto, categorias,
compartilhamento original e link para a revisão web. Não substitui Android físico.
Os scripts antigos foram atualizados; falhas intermediárias eram seletores antigos,
Metro em inicialização e seleção ambígua de duas prévias PDF. Foram repetidos com sucesso.

### Dependências: avanços e limite de segurança

Atualizados jsPDF 4.2.1, Drizzle ORM 0.45.4, Express 4.22.3 e dependências
compatíveis; SheetJS 0.20.3 pelo [canal oficial](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/).
Patch tar 7.5.22 fixado especificamente em @vercel/fun; shell-quote corrigido no
mobile. Expo-crypto alinhado a ~57.0.4. Não foi usado `npm audit fix --force`.

Consulta final `npm audit --omit=dev` (contagem de pacotes afetados, não de exploits):

| Projeto | Críticos | Altos | Moderados | Baixos | Total |
|---|---:|---:|---:|---:|---:|
| Mobile | 0 | 19 | 12 | 0 | 31 |
| Web | 0 | 38 | 5 | 2 | 45 |

**Não é uma liberação de segurança.** Triagem inicial:

- Mobile: braces/Metro (build), node-forge (certificados Expo), uuid/xcode
  (ferramentas) e decode-uri-component/query-string/Expo Router. Este último
  exige atenção ao runtime de links; não foi considerado inaplicável.
- Web: boa parte vem de Vercel CLI/adaptadores (undici 5, busboy 2, express/hono,
  path-to-regexp 6/8, parsers). Express da aplicação usa sua própria versão
  corrigida. Há também parsers/build. Docker atual copia node_modules completo:
  **não presumir que ferramentas de build estão ausentes da imagem de produção**.
- Próxima etapa de segurança deve separar ferramentas da imagem de runtime,
  revisar patches transitivos/atualizações maiores e repetir regressão. Alertas
  sem correção compatível precisam avaliação documentada, não supressão cega.
- Algumas sugestões automáticas rebaixam Expo para 44 ou exigem Expo Router 58;
  não aplicadas por risco à compatibilidade nativa. VPS, TLS, firewall, backup e
  rotação das credenciais oficiais não foram auditados/alterados nesta sessão.

### Pendências que ainda bloqueiam lançamento definitivo

1. Concluir triagem/remediação dos alertas residuais e rotação autorizada dos
   segredos oficiais compartilhados anteriormente; restringir acesso ao PostgreSQL.
2. Homologar configuração HTTPS/proxy e migrações 0002–0005 com backup antes do
   deploy. 0005 foi validada com store real e tabela temporária, não instalada em produção.
3. Vincular conta/projeto EAS e confirmar a assinatura/versionCode compatíveis
   com o APK atual. Legado contém projectId, mas não foi reutilizado sem conferência.
4. Gerar APK preview e testar no telefone **sem Metro/PC**, PDF/WhatsApp, modo avião,
   reinício, Wi-Fi/dados móveis, expiração, TalkBack e fontes maiores. Bundle HBC
   compilado não atesta essas integrações nativas.
5. Testar atualização sobre a instalação existente sem desinstalar; preservar fila,
   rascunhos e documentos. Chaves v1 foram mantidas e compatibilidade testada em
   browser, mas package/assinatura e armazenamento do aparelho ainda não foram validados.

Roteiro operacional: [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md). Próxima decisão
necessária é o ambiente de homologação/EAS e autorização de publicação; não ampliar
o app para um sistema completo como parte desta entrega.

---

## Parecer

**Não liberar a versão definitiva ainda.** O núcleo funcional está implementado
e os cenários executados passaram, mas há diferenças de dados/documentos,
pendências de segurança e homologação nativa. Não é necessário ampliar o
escopo com novas telas; concluir a estabilização e a preparação de publicação.

Esta conferência não implementou correções, não publicou APK/web e não alterou
produção. Comparação real restrita a mastergreen_develop; testes de gravação
usaram dados fictícios em transações revertidas. Logins de diagnóstico foram
encerrados. Nenhuma credencial ou dado pessoal foi incluído neste relatório.

## Evidências repetidas nesta sessão

| Verificação | Resultado |
|---|---|
| TypeScript web e mobile | Passou |
| Lint mobile | Passou |
| Testes mobile de regras/estado/exportação/link | 26/26 |
| Testes web de regras, documentos, senhas e integração SQL | 21/21 |
| Prévia mobile ux-smoke | Passou com APIs simuladas |
| Editor web completo, produtos/custos/reabertura/PDF | Passou com APIs simuladas |
| Filtros mensais, ordenação e ações | Passou com APIs simuladas |
| Link autenticado, retorno após login, PDF, 404 e retry | Passou com APIs simuladas |
| Build web | Passou, com avisos de tamanho de bundle e Browserslist antigo |
| Comparação banco/APIs | 9.597 verificações de campos/métricas sem mismatch; dashboard diverge |

A primeira execução de três arquivos de teste web não carregou DATABASE_URL;
eles foram repetidos com o ambiente de desenvolvimento correto e passaram.
Não confundir essa falha de preparação com falha funcional do aplicativo.

A amostra atual tem 288 clientes, 76 produtos, 126 propostas detalhadas e
7 rápidas; histórico mobile com 133 registros. Não foram encontrados vínculos
ausentes de cliente nas rápidas nem chaves userId/clientId duplicadas.
Essa comparação não cobre todos os campos novos de webDetails nem o cache
privado do telefone; itens/edição foram verificados separadamente nos testes SQL.

## Pendências antes do lançamento

### 1. Dependências com alertas críticos — triagem obrigatória

Consulta npm audit --omit=dev nesta sessão:

| Projeto | Críticos | Altos | Moderados | Baixos | Total |
|---|---:|---:|---:|---:|---:|
| Mobile | 1 | 22 | 13 | 0 | 36 |
| Web | 3 | 53 | 11 | 2 | 69 |

Mobile: shell-quote aparece como crítico transitivo. Web: jspdf (direto),
proxy-addr e tar aparecem como críticos. Há ferramentas de build/CLI na árvore
mesmo com omit=dev: contagem não equivale a vulnerabilidades exploráveis no
APK/servidor. Mapear versões, caminhos e exposição; corrigir/retestar ou justificar
formalmente inaplicabilidade. Não executar audit fix --force: algumas sugestões
rebaixam Expo/React Native ou trocam versões principais.

As credenciais oficiais compartilhadas anteriormente na conversa também devem
ser rotacionadas antes da publicação, em uma ação separada e autorizada.
Não foi feita auditoria completa de segurança da VPS nem teste de invasão.

### 2. PDF local pode divergir da proposta reeditada no web

Leitura confirmada do fluxo: getMobileData retorna snapshot/total atualizados;
historyWithLocal prioriza a linha remota. Porém shareSaved em
src/screens/consultation-screens.tsx gera o PDF usando queue.document e
queue.payload originais. Sincronização não atualiza esse documento após edição
web. O detalhe pode mostrar o novo total e compartilhar a versão original.

Definir e implementar comportamento: abrir versão atual no web, sincronizar um
documento revisado, ou identificar claramente a cópia original. O atalho atual
para o web só atende source=web; não resolve rápidas editadas. É um risco do
código revisado, ainda sem teste E2E dedicado no aparelho.

### 3. Dashboard web antigo apresenta custos zerados

Reconfirmado por API em 13 meses, apesar de custos no banco, relatórios avançados
e resumo mobile. server/routes.ts compara adminCalculated inteiro com true.
Exemplo setembro/2026: R$ 27.041,72 no banco/mobile e R$ 0,00 no dashboard.
Rever também seleção de versões/data e fallback de lucro zero/negativo.
O script integration-audit.mjs encerra com código 1 por essas divergências;
não considerar a auditoria integralmente aprovada só porque mismatches=[]!

### 4. Cadastro de clientes e atualização do resumo

- 33 clientes têm número, bairro ou CEP separados no web, não enviados ao app.
  getMobileData e applyCustomer continuam omitindo esses componentes.
- Cliente escolhido não mantém customerId no payload. Associação por documento
  ou telefone/nome pode duplicar cadastros sem identificadores; há 1 caso sem
  documento/telefone na amostra. Nenhuma duplicação semântica foi provada aqui.
- sync atualiza data/lastSync, não reports. SummaryScreen não reage a lastSync
  nem foco: um resumo já aberto pode exigir Atualizar resumo após sincronizar.
- Lista web tem 124 detalhadas do usuário, histórico administrativo tem 126 da
  empresa. Diferença de regra de visibilidade, não perda de sincronização;
  confirmar a regra desejada antes de alterar permissões.

### 5. Acessibilidade e cobertura de testes

- Aviso aria-hidden/foco informado pelo usuário permanece sem correção. Revisar
  transferência/restauração de foco em modais e navegação com teclado/TalkBack.
- Os testes de navegador atuais verificam pageerror; isso não captura todos
  os avisos do console. Passar sem exceções JS não significa zero avisos.
- Scripts antigos como offline-smoke.cjs ainda usam rótulos anteriores e a
  premissa de não enviar itens. Não foram contados como aprovados nesta sessão.
  Atualizar essa cobertura antes de confiar no cenário completo expiração →
  renovação → fila → reentrada. ux-smoke cobre parte do offline com APIs simuladas.

### 6. APK e publicação ainda precisam de homologação

Configuração preview/production existe; preview usa package .develop e produção
o package legado. Não há projectId EAS nos arquivos de configuração inspecionados.
Não foi consultada a conta remota nem confirmado um APK de release instalável.
O bloqueio local anterior de hermesc está documentado, não foi retestado aqui.

Antes de distribuir:

- Confirmar EAS, assinatura antiga, versionCode e URL HTTPS da API/web.
- Aplicar as migrações necessárias (0002/0003/0004) em homologação, com backup
  e plano de retorno, e só publicar em produção com autorização.
- Testar APK preview no telefone sem Metro/PC: primeiro login, modo avião,
  salvar/fechar/reabrir, PDF e WhatsApp, reconexão sem duplicar, expiração e
  renovação, restrições de bateria Xiaomi e acesso web autenticado.
- Conferir uma edição web seguida de sincronização e compartilhamento no app.
- Validar atualização sobre o APK usado pelo proprietário, compatibilidade do
  armazenamento e preservação de dados. Não desinstalar para atualizar sem backup.
- Consolidar alterações nas branches develop e marcar uma versão após homologar.

## O que não deve ampliar o lançamento

Biometria, novas telas, múltiplos usuários, paginação avançada e melhorias
cosméticas extras podem esperar. O aplicativo deve continuar rápido e simples.
Backup/exportação pode ser uma evolução posterior, mas a atualização atual
precisa preservar os dados existentes e as propostas não sincronizadas.

## Limite da conclusão

Sem garantia de ausência total de erros. Os testes dão confiança nos cenários
executados, não certificam todos os dispositivos, redes ou versões. Não houve
teste de produção, carga, recuperação de backup ou homologação do APK final.
