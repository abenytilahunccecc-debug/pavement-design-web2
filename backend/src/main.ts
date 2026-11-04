import 'dotenv/config'; // loads backend/.env locally; on Render the variables come from the dashboard
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './setup.js';

async function bootstrap() {
  const app = configureApp(await NestFactory.create(AppModule));
  const port = Number(process.env.PORT || 4000); // Render sets PORT; locally 4000 (Next.js uses 3000)
  await app.listen(port, '0.0.0.0');
  console.log(`Pavement design API listening on port ${port}`);
}
await bootstrap();
