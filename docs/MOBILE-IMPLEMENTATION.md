# Integração mobile aprovada — 11/10/2026

## Regras

- Um proprietário; primeiro login online, sessão protegida por 30 dias.
- Depois do primeiro login, cálculo/PDF locais continuam disponíveis offline.
- O cálculo legado usa 4,5% sobre o bruto, antes do desconto, independente do web.
- Propostas rápidas enviam apenas cliente, data, condições e total final.
- Itens livres e custos ficam no aparelho; não há catálogo no app.
- Envio idempotente; proposta concluída não pode ser sobrescrita por repetição.
- Sem edição, exclusão ou abertura de detalhes no histórico mobile.
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
2. **Propostas no web**: `/propostas-app`, busca e filtro mensal, atualização a
   cada 30 segundos. Condições comerciais e valor final são consultáveis; não
   há edição/exclusão nem PDF recriado no web. Relatórios existentes apontam
   para este resumo separado, sem somar propostas a receita aprovada.
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
- A API de consultas retorna o conjunto completo (interface exibe páginas de
  30); avaliar paginação no servidor se a base crescer significativamente.
