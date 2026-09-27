import type pg from 'pg';
import { statusDaAssinaturaPermiteAcesso } from './assinatura';

/** Mesmo conjunto de estados liberados pela tela de assinatura do SaaS. */
export async function temAssinaturaComAcesso(
  pool: pg.Pool,
  organizationId: string,
): Promise<boolean> {
  const { rows } = await pool.query<{ status: string }>(
    'select status from org_subscriptions where organization_id = $1',
    [organizationId],
  );
  return statusDaAssinaturaPermiteAcesso(rows[0]?.status);
}
