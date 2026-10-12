# Auditoria web × mobile — 11/10/2026

## Resultado

A transferência dos campos atualmente previstos no contrato e os relatórios
avançados estão consistentes com a base de desenvolvimento. A integração ainda
tem diferenças de cobertura, atualização e uma divergência no dashboard legado
que devem ser tratadas antes de considerar a paridade integral homologada.

Nenhuma regra da aplicação, cadastro, proposta ou dado de produção foi alterado.
O acesso direto ao banco usou transação REPEATABLE READ READ ONLY. As únicas
escritas nas APIs foram os logins de diagnóstico e seus respectivos logouts.

## Evidência executada

- Banco consultado: `mastergreen_develop`; APIs locais na porta 5001.
- 9.567 comparações aprovadas de campos, identificadores e métricas.
- 288 clientes, 76 produtos, 126 propostas detalhadas e 6 propostas do app.
- Histórico da API mobile: 132 registros, sem falta de vínculo de cliente nas
  propostas rápidas e sem duplicação da chave usuário + clientId.
- 51 propostas aprovadas: **R$ 288.180,98**.
- Propostas rápidas enviadas: **R$ 117.470,00**; não equivalem a vendas aprovadas.
- Custos registrados das aprovadas: **R$ 177.519,36**.
- Lucro registrado das aprovadas: **R$ 86.627,35**.
- 15 meses presentes na base, de agosto/2025 a outubro/2026: resumo mobile
  comparado à base e ao relatório avançado web; verificados quantidade, receita,
  ticket médio, cobertura financeira, custos, lucro, gráfico mensal,
  responsáveis, estimativa de comissão atual, propostas rápidas e período anterior.
- Campos das propostas rápidas comparados: cliente/snapshot, data, frete,
  garantia, pagamento, desconto, total e identificador de reenvio.
- 18 testes mobile existentes passaram, incluindo cálculo, fila, histórico,
  expiração, filtros, seleção de cliente e orquestração do PDF com adaptadores simulados.

## Pendências observadas

### 1. Custos zerados no dashboard legado — confirmado na API

Em todos os 13 meses com propostas aprovadas e custos registrados, a API
`/api/dashboard/:date` retornou `totalCosts: 0`, ao contrário do banco,
relatório avançado e resumo mobile. Exemplo: setembro/2026 tem **R$ 27.041,72**
de custos no banco e no app; o dashboard retorna **R$ 0,00**.

Em `server/routes.ts`, a seleção usa `adminCalculated === true`, enquanto o
schema armazena o campo como inteiro. O dashboard também tem regras próprias
de seleção/data e fallback de lucro que substitui lucro zero/negativo por
receita menos comissão. Esse segundo problema é um risco identificado por
leitura: o lucro atual bateu em todos os meses desta amostra.

Recomendação: alinhar o dashboard ao seletor e às métricas compartilhadas,
preservando cobertura explícita de custos e sem inventar lucro faltante.

### 2. Endereço incompleto no celular — confirmado na base e contrato

33 clientes têm número, bairro ou CEP em campos separados preenchidos no web.
A API mobile não envia esses campos; `applyCustomer` monta o endereço apenas
com logradouro, cidade e estado. Os dados que são enviados batem, mas a
representação é incompleta. Incluir os componentes sem alterar o cadastro original.

### 3. Resumo pode permanecer desatualizado — identificado por leitura

`sync` atualiza `data` e `lastSync`; não invalida nem atualiza `reports`.
A tela de resumo busca ao montar, mudar período ou solicitar atualização;
não depende de `lastSync`. Assim, após envio/alteração, o resumo já aberto
pode divergir temporariamente do histórico. Até corrigir, usar “Atualizar resumo”.
Não foi observado diretamente no cache privado do celular nesta auditoria.

### 4. Escopo diferente na listagem de propostas — confirmado

A lista web retorna 124 propostas detalhadas do usuário autenticado; os
relatórios administrativos e o histórico mobile retornam as 126 detalhadas
da empresa. Somadas as 6 rápidas, o histórico mobile tem 132. A diferença
é filtro de usuário, não perda na sincronização. Definir se o proprietário
deve ver o mesmo conjunto na listagem web.

### 5. Associação de cliente sem ID — risco identificado

O formulário seleciona um cliente, mas não mantém seu ID no payload. O backend
associa por documento ou telefone + nome. Existe 1 cliente sem documento e sem
telefone normalizáveis; selecioná-lo e salvar uma proposta poderá criar outro
cadastro. Alterar telefone/nome também pode impedir associação quando não há
documento. Os 6 vínculos atuais existem, mas isso não prova ausência de
duplicação semântica. Recomenda-se transmitir e validar o customerId selecionado,
mantendo alternativa para clientes digitados offline.

## Limites e diferenças intencionais

- Auditoria da base de teste e das APIs consumidas por web/mobile, não de produção.
- Sem leitura do AsyncStorage/SecureStore privado do aparelho. Para homologação
  nativa final, sincronizar no celular e atualizar o resumo no mesmo período.
- Sem envio de novas propostas nesta auditoria; salvamento offline/reconexão
  foi coberto apenas pelos testes existentes e inspeção do código.
- Itens, custos e fórmulas do orçamento rápido permanecem locais por decisão
  de escopo. O servidor recebe o resumo financeiro, sem recalcular o total.
- Cadastro e snapshot histórico são coisas distintas; a proposta preserva o
  texto enviado na época e não atualiza automaticamente um cadastro existente.
- Comissões do resumo são estimativas pela taxa atual, não pagamentos históricos.
- Produção, EAS, branches remotas e deploy não foram alterados.

## Repetir

Na pasta `sistema-web`, com credenciais locais fora do Git:

```powershell
node --env-file=.env --env-file=.env.local tests/integration-audit.mjs
```

O script não imprime credenciais, nomes ou contatos. Código de saída 1 é
esperado enquanto houver divergências do dashboard ou comparações reprovadas.
O JSON distingue divergências de campos (`mismatches`) das diferenças de
métricas (`dashboardDifferences`). As omissões e riscos de código acima
dependem também de revisão, não apenas do resultado do script.
