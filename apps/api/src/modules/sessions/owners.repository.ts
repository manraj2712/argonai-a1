import type { DbClient } from '../../db/client.js';

export class OwnersRepository {
  /** Re-creates the owner row if it vanished (e.g. a reset database) so a valid cookie keeps working. */
  async ensure(db: DbClient, id: string | null): Promise<string> {
    if (id) {
      await db.owner.upsert({ where: { id }, create: { id }, update: {} });
      return id;
    }
    const owner = await db.owner.create({ data: {} });
    return owner.id;
  }
}
