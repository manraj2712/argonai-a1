import type { CreateImagesResponse, ImageDto, ListImagesResponse } from '@image-intake/shared';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, resetDatabase } from '../support/database.js';
import { createTestApp } from '../support/test-app.js';

const db = createTestDatabase();
const { app, storage } = createTestApp(db);

afterAll(() => db.$disconnect());
beforeEach(async () => {
  await resetDatabase(db);
  storage.objects.clear();
});

const file = { filename: 'me.jpg', mimeType: 'image/jpeg', sizeBytes: 200_000 };

async function startSession(): Promise<string> {
  const response = await request(app).post('/api/sessions').expect(200);
  const cookie = response.get('Set-Cookie')?.[0];
  if (!cookie) throw new Error('no session cookie');
  return cookie.split(';')[0] ?? '';
}

async function createSlots(cookie: string, count = 1): Promise<CreateImagesResponse['items']> {
  const response = await request(app)
    .post('/api/images')
    .set('Cookie', cookie)
    .send({
      files: Array.from({ length: count }, (_, index) => ({
        ...file,
        filename: `photo-${index}.jpg`,
      })),
    })
    .expect(201);
  return (response.body as CreateImagesResponse).items;
}

describe('sessions', () => {
  it('issues a signed, httpOnly owner cookie', async () => {
    const response = await request(app).post('/api/sessions').expect(200);
    expect(response.get('Set-Cookie')?.[0]).toMatch(/^owner_id=s%3A.+HttpOnly/);
  });

  it('keeps the same owner when the cookie is sent back', async () => {
    const cookie = await startSession();
    const first = await request(app).post('/api/sessions').set('Cookie', cookie);
    const second = await request(app).post('/api/sessions').set('Cookie', cookie);
    expect(first.body).toEqual(second.body);
  });

  it('treats a tampered cookie as no session', async () => {
    const cookie = await startSession();
    const tampered = cookie.replace(/.$/, (char) => (char === 'A' ? 'B' : 'A'));
    await request(app).get('/api/images').set('Cookie', tampered).expect(401);
  });
});

describe('POST /api/images', () => {
  it('creates upload slots in request order', async () => {
    const cookie = await startSession();
    const items = await createSlots(cookie, 3);

    expect(items.map((item) => item.image.filename)).toEqual([
      'photo-0.jpg',
      'photo-1.jpg',
      'photo-2.jpg',
    ]);
    expect(items.every((item) => item.image.status === 'awaiting_upload')).toBe(true);
    expect(items[0]?.upload.fields['key']).toMatch(/^originals\//);
  });

  it('rejects the whole batch when one file is invalid', async () => {
    const cookie = await startSession();
    const response = await request(app)
      .post('/api/images')
      .set('Cookie', cookie)
      .send({ files: [file, { ...file, mimeType: 'image/gif' }] })
      .expect(422)
      .expect('Content-Type', /application\/problem\+json/);

    expect(response.body).toMatchObject({
      code: 'validation_failed',
      issues: [{ path: 'files.1.mimeType' }],
    });
    expect(await db.image.count()).toBe(0);
  });

  it('requires a session', async () => {
    await request(app)
      .post('/api/images')
      .send({ files: [file] })
      .expect(401);
  });
});

describe('POST /api/images/:id/complete', () => {
  it('refuses to complete before the bytes arrive', async () => {
    const cookie = await startSession();
    const [slot] = await createSlots(cookie);

    const response = await request(app)
      .post(`/api/images/${slot?.image.id ?? ''}/complete`)
      .set('Cookie', cookie)
      .expect(409);
    expect(response.body).toMatchObject({ code: 'upload_missing' });
  });

  it('queues the image once the bytes are in storage, and is idempotent', async () => {
    const cookie = await startSession();
    const [slot] = await createSlots(cookie);
    if (!slot) throw new Error('no slot');
    await storage.put(slot.upload.fields['key'] ?? '', Buffer.alloc(200_000), 'image/jpeg');

    const first = await request(app)
      .post(`/api/images/${slot.image.id}/complete`)
      .set('Cookie', cookie)
      .expect(202);
    const second = await request(app)
      .post(`/api/images/${slot.image.id}/complete`)
      .set('Cookie', cookie)
      .expect(202);

    expect((first.body as { image: ImageDto }).image.status).toBe('pending');
    expect((second.body as { image: ImageDto }).image.status).toBe('pending');
  });
});

describe('reading and deleting', () => {
  it("hides one owner's images from another", async () => {
    const [slot] = await createSlots(await startSession());
    const stranger = await startSession();

    await request(app)
      .get(`/api/images/${slot?.image.id ?? ''}`)
      .set('Cookie', stranger)
      .expect(404);
    await request(app)
      .delete(`/api/images/${slot?.image.id ?? ''}`)
      .set('Cookie', stranger)
      .expect(404);
    const list = await request(app).get('/api/images').set('Cookie', stranger).expect(200);
    expect((list.body as ListImagesResponse).items).toEqual([]);
  });

  it('pages through images newest first without gaps or repeats', async () => {
    const cookie = await startSession();
    const created = [...(await createSlots(cookie, 3)), ...(await createSlots(cookie, 2))];

    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const response = await request(app)
        .get('/api/images')
        .query({ limit: 2, ...(cursor && { cursor }) })
        .set('Cookie', cookie)
        .expect(200);
      const page = response.body as ListImagesResponse;
      seen.push(...page.items.map((image) => image.id));
      cursor = page.nextCursor;
    } while (cursor);

    expect(seen).toHaveLength(5);
    expect(new Set(seen)).toEqual(new Set(created.map((item) => item.image.id)));
  });

  it('filters by status', async () => {
    const cookie = await startSession();
    const [slot] = await createSlots(cookie, 2);
    await db.image.update({ where: { id: slot?.image.id ?? '' }, data: { status: 'accepted' } });

    const response = await request(app)
      .get('/api/images')
      .query({ status: 'accepted,rejected' })
      .set('Cookie', cookie)
      .expect(200);
    expect((response.body as ListImagesResponse).items.map((image) => image.id)).toEqual([
      slot?.image.id,
    ]);
  });

  it('deletes the row and its stored objects', async () => {
    const cookie = await startSession();
    const [slot] = await createSlots(cookie);
    const key = slot?.upload.fields['key'] ?? '';
    await storage.put(key, Buffer.alloc(10), 'image/jpeg');

    await request(app)
      .delete(`/api/images/${slot?.image.id ?? ''}`)
      .set('Cookie', cookie)
      .expect(204);

    expect(await db.image.count()).toBe(0);
    expect(storage.objects.has(key)).toBe(false);
  });
});

it('answers unknown routes with problem+json', async () => {
  const response = await request(app).get('/api/nope').expect(404);
  expect(response.body).toMatchObject({ status: 404, code: 'not_found' });
});
