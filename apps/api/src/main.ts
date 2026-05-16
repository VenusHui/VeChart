import 'reflect-metadata';

import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';

import { AppModule } from './app.module';

async function bootstrap() {
  const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
  const allowedOrigins = new Set(
    webOrigin
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  );

  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }

        if (allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }

        try {
          const { protocol, hostname } = new URL(origin);
          const isHttp = protocol === 'http:' || protocol === 'https:';
          const isIpHost = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
          const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

          if (isHttp && (isIpHost || isLocalhost)) {
            callback(null, true);
            return;
          }
        } catch {
          // Invalid Origin header; reject below.
        }

        callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
      },
      credentials: true
    }
  });

  app.use(cookieParser());
  app.use(json({ limit: '15mb' }));
  app.use(urlencoded({ extended: true, limit: '15mb' }));
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true
    })
  );

  const port = process.env.API_PORT ? Number(process.env.API_PORT) : 4000;
  await app.listen(port);
}

bootstrap();
