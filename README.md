# Pegboards

A ClickUp-style Kanban app with time tracking and custom metric dashboards.
Built with Next.js (Pages Router), Tailwind CSS and SQLite.

## Features

- **Boards**: Kanban columns you can customise (rename, recolour, reorder, mark as "done").
  Drag cards between columns, or change the Status field in the task panel.
- **Tasks**: title, description, priority, assignee, due date, estimate, comments.
- **Time rendered**: log time on any task either as a duration (`1.5`, `1h 30m`, `90m` or `1:30`)
  or as a start–end time range, with a date and note. A range that overlaps another range the
  same person logged that day (on any task) is rejected. Progress is shown against the estimate.
- **Dashboards**: build widgets from a metric, a grouping and filters, for example
  "Hours logged · this week · by person · Website board". Show them as a number (with change
  vs the previous period), bar chart, line chart or table. Dashboards can be shared with the team.
- **Users**: the first account is the admin. Admins add teammates, change roles and deactivate accounts.

### Dashboard metrics

| Metric | Date filter applies to |
| --- | --- |
| Hours logged | the day the time was logged |
| Tasks created | creation date |
| Tasks completed | completion date |
| Open tasks | creation date |
| Overdue tasks | due date |
| Estimated hours | creation date |
| Avg. days to complete | completion date |

Group by person, board, status, priority, day, week or month. Filter by date range, people
(including "Me", which resolves to whoever is viewing), boards, priority and open/done.

## Getting started

Requires **Node.js 22.16 or newer** (uses the built-in `node:sqlite` module, so there is
no native database driver to install).

```bash
npm install
npm run dev
```

Open http://localhost:3000. On first run you'll be sent to `/setup` to create the admin
account. Tick "Add sample boards…" to load demo data. The sample teammates sign in with
password `demo1234`.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_PATH` | `./data/pegboards.db` | Location of the SQLite file. |

The schema is created automatically on startup. Node prints an `ExperimentalWarning` for
SQLite once per process; this is expected.

**Tip:** if this folder lives in OneDrive or Dropbox, point `DATABASE_PATH` somewhere
outside it. Sync clients can lock or corrupt a SQLite file while it's in use.

## Project layout

```text
src/
├── components/   UI (board, dashboard, layout, ui primitives)
├── lib/          Client-safe helpers and option lists
├── pages/        Routes and API routes (pages/api)
└── server/       Server-only code: database, auth, queries, metrics engine
```
