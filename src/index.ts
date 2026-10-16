import 'dotenv/config';

import { createApp } from './app.js';
import { createDb } from './db/index.js';

const port = Number(process.env.PORT ?? 4000);

async function main() {
  const db = await createDb();
  const app = createApp(db);

  app.listen(port, '0.0.0.0', () => {
    console.log(`BrightSteps API listening on http://0.0.0.0:${port}`);
    console.log(`Health check: http://localhost:${port}/api/healthz`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
