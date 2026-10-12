# Integração mobile aprovada — 11/10/2026

## Regras

- Um proprietário; primeiro login online, sessão protegida por 30 dias.
- Depois do primeiro login, cálculo/PDF locais continuam disponíveis offline.
- O cálculo legado usa 4,5% sobre o bruto, antes do desconto, independente do web.
- Propostas rápidas enviam apenas cliente, data, condições e total final.
- Itens livres ficam no aparelho; o catálogo de nomes/preços do web é opcional
  e cacheado, sem sincronizar custos ou impor seleção de produtos.
- Envio idempotente; proposta concluída não pode ser sobrescrita por repetição.
- Sem edição ou exclusão no histórico mobile; propostas salvas neste aparelho
  podem ter o PDF compartilhado novamente.
- Clientes e histórico consultáveis com cache. Resumo separa valores propostos
  de vendas aprovadas e não inventa lucro/custo das propostas rápidas.
- Sincronização em Wi-Fi por padrão, ao abrir/retomar o app e reconectar.
- Configurações: conta, sincronização, dados locais, acessibilidade e versão.
- Desenvolvimento usa exclusivamente mastergreen_develop; publicação e
  mudanças em produção serão preparadas e documentadas antes de executar.

## Acompanhamento

- [x] Backend: contrato, migração aditiva, login e recebimento idempotente.
- [x] Web: consulta de propostas rápidas e resumo separado nos relatórios.
- [x] App: sessão protegida, rascunhos persistentes e fila de envio.
- [x] App: clientes, histórico, resumo e configurações.
- [x] Interface: navegação simples, identidade verde e textos grandes.
- [x] Verificação automatizada: autenticação, repetição de envio, offline e recuperação.
- [x] Distribuição: configuração de APK e roteiro de publicação/retorno.
- [ ] Homologação no Android físico: PDF nativo, seletor de data, SecureStore,
  modo avião após encerrar/reabrir e agendamento real em segundo plano.
- [ ] Definir conta proprietária de produção, aprovar backup/migração/deploy e
  vincular EAS/assinatura para gerar APK. Não executados nesta implementação.

## Decisões técnicas

`mobile_quick_proposals` é uma modalidade separada das propostas detalhadas.
Nenhum item fictício é criado. O servidor valida o total recebido e não o
recalcula. A chave `(user_id, client_id)` garante repetição segura; uma mesma
chave com conteúdo diferente recebe conflito. Cliente é associado por documento
ou telefone e nome iguais; nome isolado não causa associação automática.

## Entrega implementada

1. **Backend e banco**: `mobile_sessions` (hash do token, validade absoluta de
   30 dias) e `mobile_quick_proposals`. Transação e bloqueio por proprietário
   protegem reenvio e associação de cliente. Só o administrador com e-mail
   configurado em `MOBILE_OWNER_EMAIL` pode entrar no app. No desenvolvimento
   existe fallback explícito para a conta local de testes; produção falha fechada.
2. **Propostas no web**: a lista `/orcamentos` identifica as rápidas do app,
   sem edição/exclusão nem PDF recriado no web. A consulta separada à API ainda
   existe; relatórios não somam propostas rápidas à receita aprovada.
3. **Persistência**: AsyncStorage por URL da API e usuário. Escritas serializadas;
   falhas de disco são sinalizadas. Antes de compartilhar o PDF, o resumo é
   gravado na fila. Pré-visualizar não finaliza. Cancelar o compartilhamento não
   desfaz a proposta finalizada. Repetir Gerar PDF sem alterações reutiliza ID.
4. **Sessão**: SecureStore no Android; prévia web usa sessionStorage. A sessão
   sobrevive a reinício do servidor. Vencida, preserva cálculo/PDF offline e
   exige renovação para acessar API. Logout explícito bloqueia entrada offline
   até novo login, preservando a fila por usuário. Saída offline remove o token
   do dispositivo; a revogação remota é tentativa, e a expiração continua válida.
5. **Sincronização**: Wi-Fi por padrão; opção dados móveis. Tenta ao entrar,
   retornar ao app, mudar de rede, gerar PDF e a cada 30s em primeiro plano.
   BackgroundTask tenta lotes de 10 quando permitido pelo Android, com recibos
   separados para não disputar o estado do formulário. Não promete envio
   imediato com app fechado; a retomada confirma os mesmos IDs com o servidor.
   Referência: https://docs.expo.dev/versions/v57.0.0/sdk/background-task/.
6. **Consultas**: clientes com busca e carregamento progressivo; histórico
   resumido local+web sem duplicatas; resumo do mês separa valores propostos do
   app de propostas detalhadas aprovadas do web. Cache informa última atualização.
7. **Configurações**: conta, renovação, sincronizar agora, rede, quantidade de
   dados/pendências, fonte grande/extragrande, alto contraste, versão e suporte.
   Sem editor de conexão PostgreSQL, limpeza destrutiva ou funcionalidades falsas.
8. **Interface**: abas Orçar, Clientes, Histórico, Resumo; engrenagem de ajustes;
   proposta acessível pelo fluxo rápido. Verde da marca, botões grandes e
   confirmação para limpar formulários. Biométrico, backup/exportação da base,
   valores comerciais padrão e alertas de atualização ficam para fase futura.

## Verificações realizadas

- Web TypeScript e build; testes SQL com rollback: contrato, associação do
  cliente, repetição, conflito e preservação do total.
- API HTTP real: autenticação válida/inválida, expiração emitida para 30 dias,
  acesso sem token, payload inválido, mês inválido e revogação no logout.
- Fluxo real API → PostgreSQL → página web: uma proposta fictícia identificada
  como `Cliente de teste — integração`, R$ 720, permanece só em develop.
- App TypeScript, lint, 9 testes de cálculo/estado; Expo Doctor 21/21.
- Navegador: entrada, cálculo, rascunho após reload, API offline, fila/reenvio
  único, fonte, clientes, logout, formulário, máscaras e HTML/PDF sem scripts.
- Bundle Android de desenvolvimento entregue com HTTP 200. Isso não confirma
  funcionamento nativo no aparelho; checklist de homologação permanece aberto.

## Amostra real para homologação — 11/10/2026

- `mastergreen_develop` recebeu 285 clientes, 73 produtos, 18 custos e 126
  propostas detalhadas da base oficial: 51 aprovadas e 75 pendentes, com 189
  itens e 462 custos vinculados. A proposta rápida fictícia anterior foi mantida.
- A importação leu a origem em transação `READ ONLY` e escreveu somente no banco
  de desenvolvimento, em transação com verificações de contagem e total.
- Os usuários de origem foram copiados apenas para preservar relacionamentos,
  com e-mails inválidos e hashes substituídos; o login continua sendo a conta
  local de desenvolvimento. O histórico do administrador principal foi vinculado
  a essa conta: 124 propostas aparecem em Propostas; duas de outro administrador
  permanecem visíveis nos relatórios e no histórico mobile.
- A base de desenvolvimento agora contém dados pessoais e financeiros reais.
  Restringir acesso e nunca versionar dump, registros ou credenciais. O script
  `scripts/import-real-sample.mjs` executa prévia por padrão e aceita `--apply`.
  `tests/imported-data-smoke.mjs` confere banco e respostas autenticadas da API.

## Publicação e retorno (não executados)

1. Fazer backup verificado do banco oficial e confirmar conta proprietária/admin.
2. Aplicar `migrations/0002_mobile_quick_proposals.sql` na base de homologação
   primeiro; depois, somente com aval, executar dentro de transação em produção.
   Não usar `db:push` indiscriminadamente nem o migrador de dev na base oficial.
3. Publicar web/API HTTPS com `MOBILE_OWNER_EMAIL` correto; nunca colocar senha
   de banco no app. Validar login e proposta fictícia em homologação.
4. No app, configurar `EXPO_PUBLIC_API_URL` no ambiente EAS. `app.config.ts`
   recusa build remoto sem HTTPS. Vincular projeto EAS e conferir credenciais
   de assinatura; não foi criado projeto remoto nem disparado build pago.
5. `eas build --platform android --profile preview` gera pacote `.develop`
   separado do aplicativo usado pelo pai. Só após homologação usar profile
   production, conferir versão/code e a mesma assinatura do APK antigo.
6. Testar no Android o modo avião após reabrir, PDF/compartilhar, retorno do
   Wi-Fi, login expirado e restrições de bateria Xiaomi. Expo Go depende do
   Metro para carregar código; o APK é necessário para validar uso independente.
7. Rollback: preservar tabelas, tokens e fila. Reimplantar o web anterior se
   necessário; não apagar registros. App avisa API indisponível e mantém fila.
   Não desinstalar o app para resolver falha: isso pode apagar dados locais.

## Pendências técnicas conhecidas

- A execução de `hermesc.exe` para bytecode de produção está bloqueada pelo
  Controle de Aplicativos do Windows; build remoto EAS é alternativa, após
  configuração/autorização da conta. Não contornar política do Windows.
- npm audit informou 36 alertas no conjunto mobile (13 moderados, 22 altos,
  1 crítico). Não foi feito upgrade forçado que altere o SDK. Revisão de
  dependências é necessária antes de distribuição de produção.
- A API de consultas retorna o conjunto completo (interface usa listas
  virtualizadas); avaliar paginação no servidor se a base crescer significativamente.

## Integração de catálogo e lista única — 11/10/2026

- `/api/mobile/data` inclui catálogo de produtos com nome, categoria, descrição
  e preço por m², sem custo. O app mantém cache para seleção pesquisável offline;
  selecionar preenche descrição/preço e deixa metragem/preço editáveis. Adição
  manual continua, sem cadastrar produto novo no catálogo central.
- Salvar proposta grava resumo na fila e cópia local dos itens/condições para
  compartilhar o PDF pelo Histórico mais tarde. Gerar e compartilhar salva antes
  de abrir o compartilhamento; Visualizar PDF permanece sem finalizar.
- O web mostra propostas detalhadas e rápidas na mesma tabela de Propostas,
  identificadas por origem. Propostas rápidas não recebem ações de edição ou
  aprovação. Desde 11/10/2026 podem ser abertas para consulta e exportação de PDF
  do resumo; continuam sem itens/custos na API e no PostgreSQL.
  A rota antiga `/propostas-app` saiu da navegação, mas abre a mesma lista para
  preservar links existentes; o relatório aponta à lista.

## UI/UX e resumo por período — 11/10/2026

- `/api/mobile/summary` exige a mesma sessão proprietária; datas inclusivas
  validadas, valores em centavos, comparação de duração equivalente e cache
  por usuário/período no aparelho (24 consultas). OpenAPI atualizado.
- `server/reporting.ts` centraliza os relatórios avançado/executivo e histórico
  mobile. Admin conta a versão calculada quando existe, uma vez por original;
  situação comercial vem da versão escolhida e criação vem da original, em America/Sao_Paulo. Funcionário
  continua vendo somente seus originais, sem versões calculadas do administrador.
- Custos/lucro exibidos só no subconjunto com total_costs positivo, sem alegar
  completude. Comissão pela taxa atual é identificada como estimativa, não como
  comissão histórica paga. Proposta rápida não entra em vendas aprovadas.
- Dashboard antigo do web não foi refeito; pode ter regras diferentes dos
  relatórios avançados. Não usar seus fallbacks de lucro como fonte do mobile.
- Testes adicionais: `tests/report-metrics.test.ts`, `tests/report-integration.test.ts`
  (somente develop, transação revertida) e paridade em `tests/imported-data-smoke.mjs`.
- Sem migração de banco nesta etapa; produção permanece intocada. O novo visual
  mobile está em `app-mastergreen/docs/UI-UX-PLAN.md`.

## Documentos e catálogo — 11/10/2026

- `/configuracoes` (admin) configura nome, razão social, documento, endereço,
  telefone, e-mail, PIX/beneficiário, responsável/cargo, pagamento padrão do web
  e validade padrão do app. Perfil salvo atomicamente na chave `company_profile`
  da tabela existente `system_settings`; nenhuma migração ou alteração em produção.
- Defaults foram reunidos dos PDFs antigos, usando a razão social e beneficiário
  completos existentes no web. Conferir os dados antes de enviar ao cliente.
- `GET /api/company-profile` exige sessão web; `PUT` exige admin e validação Zod.
  O app recebe `company` em `/api/mobile/data`, preservando geração offline.
  Arquivos já enviados não mudam; novas gerações usam configuração atual/cache.
- Os dois geradores web antigos agora convergem ao mesmo modelo jsPDF. Documento
  comercial verde, tabela com descrição e quantidades decimais, total destacado,
  condições, pagamento e assinatura. Mobile usa HTML de mesma direção visual;
  salvamento/compartilhamento base64 do Expo mantido. Paginação verificada.
- Botão “Abrir proposta” na tabela/cards abre o snapshot enviado pelo celular.
  PDF do resumo não inventa itens, custos, validade nem aprovação que não chegaram.
- Correção do catálogo (pedido posterior em 11/10/2026): retirada a organização
  paralela de Configurações e a API `/api/catalog-presentation`. App filtra pela
  categoria original de `products.category`, sem inferir tipo/categoria pelo nome.
  Busca e seletor de categoria ficam em Proposta → Escolher produto do sistema.
  Nome, descrição e preço por m² vêm do cadastro existente no web. Metadados
  `catalog` de caches anteriores são ignorados, sem apagar dados do aparelho.
  Custos internos permanecem em opção separada, nunca como preço de venda automático.
  Dados de `catalog_presentation` eventualmente persistidos ficam inativos no banco,
  sem exclusão. Classificador antigo arquivado em `_Arquivo`.
- Testes: `proposal-documents.test.ts`, `document-integration-smoke.cjs` (salva
  somente os mesmos valores correntes de empresa), `catalog.test.cjs`
  e `ux-smoke.cjs` mobile com fixtures isoladas. Artefatos em `dist/pdf-review`.
- Auditoria anterior permanece como pendência: dashboard legado, endereço completo
  dos clientes, invalidação do resumo, escopo da lista e customerId não foram
  modificados nesta entrega.

## Lista mensal de propostas — 12/10/2026

### Edição web dos resumos vindos do app — 12/10/2026

#### Ampliação posterior: editor completo — 12/10/2026

- Pedido explícito posterior substitui a variante limitada ao resumo descrita
  abaixo. Propostas do app agora usam `DetailedQuotationForm`, o mesmo componente
  de produtos, custos, resumo financeiro e configurações das propostas web.
  Menu de três pontinhos preservado. Itens antigos ausentes não são inventados.
- Pode acrescentar/remover produtos, quantidades, preço de venda e custo unitário;
  custos fixos/percentuais com associação ao produto; validade, título, responsável,
  observações, garantia e frete. Cliente/data/pagamento recebidos continuam editáveis.
- Modo inicial “Manter valor final informado” preserva centavos e evita aplicar
  desconto duas vezes. “Calcular pelos produtos e desconto” opta pelo novo total.
  Preview e servidor usam `calculateQuickDetails`; custos percentuais preservam
  tipo/base/percentual ao reabrir. Lucros são estimativas, não aprovação/receita.
- Migração aditiva `0004_mobile_proposal_details.sql`: coluna nullable
  `web_details` guarda snapshot comercial versionado e validado (ordem, nomes,
  preços e configurações históricos). É um documento atômico da proposta, não
  um segundo cadastro de produtos/custos. Os catálogos existentes permanecem
  normalizados e não são alterados ao editar. Sem novas linhas de proposta.
- Detalhes e resumo financeiro gravados juntos, sob bloqueio/revisão. Hash original,
  clientId, número e cadastro mestre preservados. Cliente antigo que omite detalhes
  já gravados recebe 409 em vez de apagar o detalhamento. PDF web inclui produtos,
  validade, título e observações, mas nunca custos internos.
- Aplicação somente em develop, com runner restrito:
  `node --env-file=.env --env-file=.env.local scripts/migrate-proposal-details-dev.mjs`.
  Aplicar migração antes do deploy da API. Rollback de código mantém a coluna/dados;
  não remover a coluna. Produção não foi alterada. PDFs/cópias locais do celular
  continuam originais; esta etapa complementa no web, não reescreve o aparelho.
- Testes: `quick-proposal-details.test.ts` (cálculos e transações revertidas),
  `quick-proposal-full-editor-smoke.cjs` (browser com fixtures e PDF), além dos
  testes anteriores de edição/contratos/documentos. PDF de referência do usuário
  tinha conteúdo visual na primeira página e cinco páginas em branco; restante
  dos controles foi conferido no formulário web real.

#### Implementação inicial de resumo (ampliada acima)

- Pedido posterior autoriza edição no web, substituindo a limitação anterior
  de somente consulta. A lista usa o menu minimalista de três pontinhos com
  “Visualizar” e “Editar”, tanto na tabela quanto nos cards. O diálogo também
  oferece edição; ambos usam a página existente
  `/orcamentos/novo?edit=<uuid>&source=app` e a variante de resumo de `NewQuotationForm`.
- Cliente (nome, contato, telefone, documento, endereço), data, pagamento,
  frete, garantia, desconto informado e total final podem ser salvos/reeditados.
  Snapshot é da proposta: não altera cadastro mestre nem outras propostas.
- Não há conversão para proposta detalhada, nova linha, mudança de número/origem,
  aprovação ou lucros estimados. Itens antigos não chegaram ao servidor e não
  são reconstruídos. Total em centavos preservado; desconto já aplicado é
  informativo, nunca aplicado uma segunda vez. Usuário ajusta total explicitamente.
- GET/PUT `/api/quick-proposals/:id` exigem sessão admin. Zod compartilhado,
  revisão opaca e bloqueio de linha transacional impedem perda de edição entre abas.
  409 mantém campos digitados e pede reabertura/conferência. Tela não monta
  formulário vazio quando o carregamento falha.
- `payload_hash` e `client_id` do envio original permanecem intactos; reenvio
  idêntico do aparelho confirma recebimento sem sobrescrever edição web.
  Lista, resumo PDF web e próxima leitura da API mobile usam os dados editados.
  Proposta/PDF já salvos localmente no celular não são reescritos por esta entrega.
- Sem migração, nova dependência ou alteração em produção. Testes SQL em
  transações revertidas: `tests/quick-proposal-edit.test.ts`; interface com
  fixtures: `tests/quick-proposal-edit-smoke.cjs`; API local sem gravação:
  `tests/quick-proposal-edit-api.mjs`. Contrato em `docs/openapi-mobile.yaml`.

- Numeração do app: `quotationNumber` persistido no servidor no padrão `#` +
  8 dígitos, usado na lista/busca/detalhe e PDF do resumo gerado pelo web.
  Migração `0003_mobile_proposal_numbers.sql` preenche números das propostas
  existentes sem alterar UUID, clientId, datas, valores ou números web antigos.
  Gatilhos serializam alocação web/app, verificam colisões nas duas tabelas e
  preservam o número mobile em reenvios. O UUID continua sendo a chave interna.
  Aplicar a migração em transação antes de publicar a API leitora; rollback de
  código pode manter a coluna/gatilhos, sem apagar números já atribuídos.
  Runner restrito a develop: `node --env-file=.env --env-file=.env.local scripts/migrate-proposal-numbers-dev.mjs`.
  Produção não foi migrada. PDF nativo/offline do telefone não foi alterado;
  a numeração é atribuída na recepção pelo servidor, sem exigir rede para gerar no app.

- Web inicia mês/ano atuais no fuso de Brasília. Ambos são obrigatórios;
  os 12 meses ficam disponíveis e limpar filtros retorna ao período atual.
- Datas acessíveis continuam carregadas para manter anos anteriores selecionáveis.
  Ordenação decrescente única por data para propostas web e app, em tabela/cards;
  horário desempata quando disponível. Selos de origem: “App” e “Web”.
- Testes: `tests/quotation-list.test.ts` e `tests/quotation-filters-smoke.cjs`.
  Sem alteração de banco ou de regras financeiras.

## Itens do app e nova proposta acessível — 12/10/2026

- Pedido posterior substitui envio limitado ao resumo: app guarda o productId
  escolhido e envia descrição, quantidade, unidade e preço de venda históricos.
  Itens livres enviam productId null; custo interno não é transmitido.
- API valida até 100 itens e inicializa web_details na mesma transação da proposta.
  Reutiliza a coluna da migração 0004, sem nova migração. Editor web permite
  alterar descrição/unidade, selecionar catálogo, adicionar itens/custos e salvar.
  Custo desconhecido começa em zero, com aviso; preço negociado não vira custo.
  Total continua manual até escolha explícita de recalcular pelos itens.
- Na retomada online, fila antiga com documento local pode reenviar itens com o
  clientId/resumo original. Hash legado permite somente complementar resumos
  intactos, sem web_details; dados já editados não são sobrepostos. Flag local
  itemsSynced evita repetir o processo. Sem cópia local não se inventam itens.
- Nova proposta fica fixa abaixo do cabeçalho, com confirmação e aviso sobre
  campos não salvos. Limpa formulário/lastFinalized, não fila nem histórico;
  cancelamento preserva campos e falha de gravação restaura o rascunho.
- Testes: 24 testes unitários mobile, tipos/lint, 7 testes web transacionais
  revertidos, ux-smoke (reset/recuperação/sem duplicação) e editor completo
  (produtos e múltiplos itens livres). Testes de tela usam APIs simuladas.
- Produção não alterada. Validar no celular após Reload e sincronização Wi-Fi.

## Abrir proposta web pelo histórico do app — 12/10/2026

- O detalhe de propostas Web no histórico mobile tem Abrir no sistema web,
  usando `/orcamentos?view=UUID`. Abre o navegador; PDFs locais do app mantêm
  seu compartilhamento existente. Não há link público nem token na URL.
- A página usa GET `/api/quotations/:id` já protegido pela sessão e permissões
  existentes, independente do filtro mensal da lista. Login preserva somente
  essa rota e UUID válidos; login comum continua no dashboard. Há loading,
  erro de conexão, proposta indisponível, retry e volta à lista.
- `EXPO_PUBLIC_WEB_URL` é opcional para web/API em origens separadas; fallback
  na origem de `EXPO_PUBLIC_API_URL`. HTTPS fora do desenvolvimento. No celular
  em desenvolvimento, o PC deve estar acessível na rede local.
- Verificados tipos em ambos, lint e 26 testes mobile, ux-smoke com abertura de
  nova aba, quotation-deep-link-smoke (login, proposta antiga, PDF, 404, retry e
  link inválido) e regressão dos filtros. Dados simulados, sem escrita no banco.
  Abertura pelo navegador Android ainda deve ser conferida no aparelho.

## Estabilização pré-lançamento — 12/10/2026

- Endereço completo e customerId na seleção mobile; resumo renova após sync/foco.
- Dashboard/extrato/lista administrativa usam a base canônica dos relatórios.
  Não transforma proposta rápida em venda aprovada, não recalcula o orçamento local.
- Histórico conserva a cópia original e oferece versão atual no web para App/Web,
  com autenticação e retorno ao documento; edição permanece exclusiva do web.
- Foco da prévia web corrigido e testes offline atualizados. Cookies de produção
  seguros, login limitado e store PostgreSQL (migração 0005 explícita antes do deploy).
- 27 testes mobile, 25 web, seis fluxos de navegador e segurança HTTP passaram.
  Comparação real: 10.488 verificações, sem divergências; build web e bundle Android
  Hermes passaram. Ainda não houve build/instalação do APK final nem deploy.
- Dependências críticas corrigidas, mas alertas residuais seguem como gate de segurança.
  Resultado detalhado: RELEASE-AUDIT-2026-10-12.md. Publicação e roteiro físico:
  RELEASE-CHECKLIST.md. Ambos substituem as contagens/pendências históricas anteriores.
