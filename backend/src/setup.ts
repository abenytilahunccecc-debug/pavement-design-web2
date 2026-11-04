import { INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * Turns CORS_ORIGINS ("https://app.vercel.app,https://app-*.vercel.app,http://localhost:3000")
 * into a check function. "*" matches any characters, so Vercel preview URLs can be allowed.
 */
export function corsOriginChecker(setting = process.env.CORS_ORIGINS || 'http://localhost:3000') {
  const patterns = setting.split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean)
    .map((p) => new RegExp('^' + p.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*') + '$'));
  return (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // No Origin header = not a browser cross-site request (curl, Render health check): allow.
    if (!origin) return callback(null, true);
    callback(null, patterns.some((p) => p.test(origin)));
  };
}

/** Settings shared by the real server (main.ts) and the end-to-end tests. */
export function configureApp(app: INestApplication): INestApplication {
  app.enableCors({ origin: corsOriginChecker(), credentials: false });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,            // drop properties that are not in the DTO
    forbidNonWhitelisted: true, // ...and report them as an error instead of silently ignoring
    transform: true,            // turn plain JSON into DTO class instances (needed for nested validation)
  }));
  app.enableShutdownHooks();
  return app;
}
