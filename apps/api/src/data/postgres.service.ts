import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class PostgresService implements OnModuleDestroy {
  private readonly logger = new Logger(PostgresService.name);
  private readonly pool: Pool;

  constructor(configService: ConfigService) {
    this.pool = new Pool({
      host: configService.get<string>('POSTGRES_HOST'),
      port: Number(configService.get<string>('POSTGRES_PORT', '5432')),
      user: configService.get<string>('POSTGRES_USER'),
      password: configService.get<string>('POSTGRES_PASSWORD'),
      database: configService.get<string>('POSTGRES_DB'),
      ssl: false
    });
  }

  async query<T extends QueryResultRow>(
    text: string,
    values?: unknown[]
  ): Promise<QueryResult<T>> {
    try {
      return await this.pool.query<T>(text, values);
    } catch (error) {
      this.logger.error(`Database query failed: ${text}`);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
