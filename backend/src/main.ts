import 'dotenv/config';
import { join } from 'path';
import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Todas las rutas de la API quedan bajo /api (el healthcheck de Azure y el
  // proxy del frontend en producción dependen de este prefijo). Los archivos
  // estáticos de /uploads quedan afuera: useStaticAssets no pasa por acá.
  app.setGlobalPrefix('api');

  // Lee cookies (usamos "userId" como sesión, igual que antes en Next).
  app.use(cookieParser());

  // Errores con forma { error: "mensaje" }, como en la versión original.
  app.useGlobalFilters(new HttpExceptionFilter());

  // El frontend (Next) vive en otro origen, así que habilitamos CORS con
  // credenciales para que la cookie viaje en las peticiones fetch.
  // FRONTEND_ORIGIN acepta varios orígenes separados por coma: en el
  // despliegue en LAN conviven el dominio (https://unistream.lan) y el acceso
  // directo por IP (https://192.168.13.20) mientras se prueba la red.
  const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
    credentials: true,
  });

  // Servimos los videos subidos en /uploads (antes lo hacía Next desde /public).
  app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads' });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Backend Nest.js escuchando en http://localhost:${port}`);
}
bootstrap();
