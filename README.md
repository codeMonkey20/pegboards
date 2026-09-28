# Pegboards

A ClickUp-style Kanban app with time tracking and custom metric dashboards.
Built with Next.js (Pages Router), Tailwind CSS and MongoDB.

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

Requires **Node.js 20.19 or newer** and a MongoDB database (a free
[MongoDB Atlas](https://www.mongodb.com/atlas) cluster works).

1. Copy `.env.example` to `.env.local` (or `.env`) and set `MONGODB_URI`.
2. Install and run:

   ```bash
   npm install
   npm run dev
   ```

3. Open http://localhost:3000. On first run you'll be sent to `/setup` to create the admin
   account. Tick "Add sample boards…" to load demo data. The sample teammates sign in with
   password `demo1234`.

Collections and indexes are created automatically on first connection.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | (required) | MongoDB connection string. |
| `MONGODB_DB` | `pegboards` | Database name inside the cluster. |

## Deploying to Vercel

1. In the Vercel project, go to **Settings → Environment Variables** and add `MONGODB_URI`
   (and `MONGODB_DB` if you use a different name). `.env` files are not uploaded.
2. In MongoDB Atlas, go to **Network Access** and allow `0.0.0.0/0`. Vercel's servers don't
   have fixed IP addresses. Alternatively, use Vercel's MongoDB Atlas integration, which sets
   this up for you.
3. Redeploy.

## Project layout

```text
src/
├── components/   UI (board, dashboard, layout, ui primitives)
├── lib/          Client-safe helpers and option lists
├── pages/        Routes and API routes (pages/api)
└── server/       Server-only code: database, auth, queries, metrics engine
```
