# Quartel de Estudos

Planejador de estudos para concursos militares (ITA, IME, EFOMM e EsPCEx). Junta o visual e as ferramentas do
Quartel (painel, cronômetro, ciclos, estatísticas, questões, notas) com o calendário mensal e as matérias por tópicos do
planejador de ciclo, e acrescenta:

- **Login** — cada recruta tem sua conta (cadastro, entrada, recuperação de senha e convites).
- **Calendário** — mês inteiro com horas líquidas e brutas, meta do dia, descansos, revisão/leitura e compromissos, com
  painel do dia ao lado.
- **Matérias com tópicos e subtópicos** — cada matéria pode ser dividida em tópicos e cada tópico em subtópicos, com
  estado (não visto → estudando → estudado → revisado) e opção “fora do programa”. A EFOMM já vem com o programa completo.
- **Biblioteca online** — envie PDFs (até 150 MB) e leia direto no site; os arquivos ficam guardados no próprio site.
- **Ranking** — classificação por horas líquidas na semana, no mês e no geral, com sequência de dias, tópicos e acertos.

## Tecnologias

- TanStack Start (React 19, TanStack Router e Query), Vite 8, Tailwind CSS 4, shadcn/ui
- Zustand para o estado local do estudante (salvo no navegador, separado por conta)
- Netlify Identity (`@netlify/identity`) para login
- Netlify Database (Postgres + Drizzle ORM) para a biblioteca e o ranking
- Netlify Blobs para os arquivos PDF

## Rodando localmente

```sh
pnpm install
netlify dev   # sobe o app com login, banco e Blobs emulados
```

`pnpm dev` também funciona para a interface, mas login, biblioteca e ranking precisam do ambiente Netlify (`netlify dev`).

Mudou `db/schema.ts`? Gere a migração com `pnpm db:generate --name <descricao>`; ela é aplicada automaticamente no deploy.

## Próximos passos sugeridos

- Sincronizar todos os dados de estudo com a conta (hoje ficam no aparelho; backup em Configurações).
- Marcar o tópico estudado direto no cronômetro / registro de estudo.
- Grupos ou turmas no ranking e moderação da biblioteca por administradores.
