# AGENTS.md

Guia para agentes e desenvolvedores que trabalham neste projeto.

## Visão geral

"Quartel de Estudos": planejador de estudos para concursos militares. Base visual e funcional vinda de um app
TanStack Start (antes no Lovable), com o calendário e as matérias por tópicos de um planejador HTML de ciclo de estudos.
Todo o texto da interface é em português do Brasil.

## Arquitetura

- **Estado do estudante** (perfil, matérias, tópicos, ciclos, sessões, compromissos, notas, livros pessoais, questões)
  fica em `src/lib/store.ts` (Zustand + persist no IndexedDB do navegador, com leitura de dados antigos do
  localStorage e fallback para ele; o banco de questões passa de 5 MB). A chave de armazenamento é por usuário
  (`quartel-estudos-v1:<userId>`), definida por `bindStoreToUser` antes da hidratação em `AppShell`. Trocar de conta
  sempre recarrega a página (logout faz `window.location.href = "/"`).
- **Login**: `src/lib/identity.tsx` (provider + `useIdentity`) e `src/components/LoginScreen.tsx`. `AppShell` bloqueia
  todo o app até haver usuário; depois mostra o onboarding se não houver perfil.
- **Servidor**: rotas HTTP do TanStack Start em `src/routes/api.*.ts`. Módulos só de servidor usam o sufixo `.server.ts`
  (`src/server/`). Toda rota protegida chama `requireUser()`; mutações chamam `sameOrigin()`.
  - `api.biblioteca*.ts`: biblioteca compartilhada de PDFs. Metadados na tabela `library_books`; o arquivo vai para o
    store de Blobs `biblioteca-pdfs` em partes de 3 MB (`<id>/<n>`), por causa do limite de corpo das funções. Fluxo:
    POST cria (status `uploading`) → PUT de cada parte → PATCH confere as partes e publica (`ready`). O leitor
    (`src/routes/leitor.$id.tsx`) baixa as partes, monta um Blob e abre num iframe.
  - `api.ranking.ts`: o cliente envia só agregados (`computeRankingStats` em `src/lib/ranking.ts`, com debounce via
    `useRankingSync`) para `ranking_stats`. Os números vêm do cliente (ranking amistoso, não auditado).
- **Banco**: `db/schema.ts` (Drizzle), `db/index.ts`, migrações em `netlify/database/migrations/` (geradas com
  `drizzle-kit generate --name ...`; nunca editar migrações aplicadas).
- **Banco de questões** (aba Questões): questões do aluno em `questionBank` (concurso → matéria → tópico → nível 1–3,
  com várias `attempts`), matérias/tópicos em `qTaxonomy`, semeada de `src/data/taxonomia.json` na primeira abertura
  e depois editável pelo aluno. A lógica pura (filtros, estatísticas, importação JSON/CSV, duplicatas, migração) está
  em `src/lib/qbank.ts`; as telas, em `src/components/questoes/`. Os dados persistidos estão na versão 2: o `migrate`
  do persist e o `importData` passam por `upgradeQuestionData`, que converte as respostas da antiga aba "Praticar"
  (`practice` + `legacy-practice.ts`) em questões do banco. `questionLogs` continua como "registros em lote".
  Não embuta questões no código: o banco vem do aluno. A importação aceita vários arquivos de uma vez; um CSV
  de pendências (`materia, questao, pagina, motivo, fonte`, sem `enunciado`) anexa avisos (`pending`) às
  questões com a mesma fonte (filtro "Com pendência"; o aluno pode cadastrar o gabarito ao resolver).
- **Tópicos**: tipos `Topic`/`TopicStatus` em `src/lib/types.ts`; utilitários e programa da EFOMM em `src/lib/topics.ts`.
  O progresso conta folhas (subtópicos quando existem); um tópico com subtópicos mostra o menor estado entre eles.
- **Revisão espaçada** (aba Revisões, `src/routes/revisoes.tsx`): itens `ReviewItem` em `reviews` no store, um por tópico
  (folha) ou assunto avulso. Lógica pura em `src/lib/review.ts` (testes em `review.test.ts`): método **fixo** (calendário de
  intervalos, padrão 1·7·15·30·60·90, presets em `SCHEDULE_PRESETS`) ou **adaptativo** (SM-2 com os quatro botões do
  Anki). Quatro notas: esqueci (volta ao início, conta lapso), difícil (repete a etapa em 60%), lembrei (próxima etapa),
  fácil (pula uma). Crédito por atraso lembrado; com `examDate`, intervalo ≤ 20% dos dias até a prova (Cepeda 2008) e
  nunca depois da véspera; intervalo > 180 dias = "dominada"; 8 lapsos = caso-problema (leech). Fila ordenada pela retenção
  estimada (curva do FSRS, 90% no dia marcado) e limitada por `dailyCap`; `skipRestDays` empurra para dia útil.
  Preferências em `profile.review` (`reviewSettingsOf` aplica os padrões). Criação automática: tópico que vira "estudado"
  em Matérias (`autoFromTopics`) e diálogo depois de finalizar o cronômetro (`ReviewScheduleDialog`). Uma nota ≥ "lembrei"
  marca o tópico como "revisado"; zerar a fila marca `dayMeta.reviewDone`. O link "Questões do tópico" abre `/questoes`
  com `?aba=&materia=&topico=` (casamento por nome normalizado com a taxonomia do banco).

## Diretórios principais

```
db/                         esquema e cliente Drizzle
netlify/database/migrations migrações SQL aplicadas no deploy
src/components/             AppShell (layout, navegação, conta), LoginScreen, LibraryTab, ReviewScheduleDialog, diálogos, kit visual
src/lib/                    store, cálculos (calc/stats), tópicos, revisão espaçada (review), ranking, biblioteca, identity
src/routes/                 páginas (index, cronometro, ciclos, calendario, materias, agenda, estatisticas,
                            revisoes, questoes, notas, livros, leitor.$id, ranking, configuracoes) e rotas api.*
src/server/                 helpers só de servidor (auth, Blobs)
src/styles.css              tema "caderno de campanha" (oliva, areia, latão) em oklch
```

## Convenções

- Use os componentes de `src/components/kit.tsx` (`PageHeader`, `Panel` com `tone`, `Stat` com `tone`/`icon`, `Bar`,
  `Empty`, `Dot`, `Tag`, `Stamp`, `SectionLabel`) e as cores de tema (`bg-field`, `text-brass`, `status-*`) para manter o
  visual. Utilitários próprios em `styles.css`: `hairline-brass`, `stamp`, `rule-double`, `numeral`, `stagger`, `press`,
  `shimmer`, `grid-paper(-strong)`. O grão de papel é um `body::before` fixo.
- `tsconfig` é estrito (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`).
- Gerenciador de pacotes: pnpm. Não editar `src/routeTree.gen.ts` (gerado).
- Dados novos que precisam ser compartilhados entre usuários vão para o Netlify Database; arquivos para Blobs.
