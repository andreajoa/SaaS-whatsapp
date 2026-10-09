import pg from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPool } from './pool';

afterEach(() => vi.unstubAllEnvs());

describe('certificado do Postgres online', () => {
  it.each(['verify-full', 'no-verify', 'disable'])(
    'preserva a CA e exige TLS mesmo com sslmode=%s na URL', async (mode) => {
      vi.stubEnv('SUPABASE_DB_CA_CERT', 'CA sintética para verificar o contrato');
      const pool = createPool(`postgresql://app:synthetic@database.example.test:5432/postgres?sslmode=${mode}`);
      try {
        // O Client real interpreta a URL novamente: observar só pool.options
        // esconderia o pg sobrescrevendo a CA pelo sslmode da connectionString.
        const client = new pg.Client(pool.options);
        expect(client.ssl).toEqual({
          ca: 'CA sintética para verificar o contrato',
          rejectUnauthorized: true,
        });
      } finally { await pool.end(); }
    },
  );

  it('sem CA adicional preserva a configuração da conexão existente', async () => {
    vi.stubEnv('SUPABASE_DB_CA_CERT', '');
    const pool = createPool('postgresql://app:synthetic@database.example.test:5432/postgres?sslmode=verify-full');
    try { expect(new pg.Client(pool.options).ssl).toEqual({}); }
    finally { await pool.end(); }
  });
});
