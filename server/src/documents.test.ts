import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDbPath = path.join(__dirname, '..', 'data', 'test.db');

process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = testDbPath;
process.env.JWT_SECRET = 'test-secret';

if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

const { closeDb } = await import('./db.js');
const { default: app } = await import('./index.js');

describe('Document sharing API', () => {
  let aliceToken: string;
  let bobToken: string;
  let carolToken: string;
  let documentId: string;

  beforeAll(async () => {
    const aliceLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@ajaia.test', password: 'password123' });
    aliceToken = aliceLogin.body.token;

    const bobLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bob@ajaia.test', password: 'password123' });
    bobToken = bobLogin.body.token;

    const carolLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'carol@ajaia.test', password: 'password123' });
    carolToken = carolLogin.body.token;
  });

  afterAll(() => {
    closeDb();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('creates a document as owner', async () => {
    const res = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Team Notes' });

    expect(res.status).toBe(201);
    expect(res.body.document.title).toBe('Team Notes');
    documentId = res.body.document.id;
  });

  it('shares document with edit permission', async () => {
    const res = await request(app)
      .post(`/api/documents/${documentId}/share`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ email: 'bob@ajaia.test', permission: 'edit' });

    expect(res.status).toBe(201);
    expect(res.body.share.email).toBe('bob@ajaia.test');
    expect(res.body.share.permission).toBe('edit');
  });

  it('shows shared document in recipient list', async () => {
    const res = await request(app)
      .get('/api/documents')
      .set('Authorization', `Bearer ${bobToken}`);

    expect(res.status).toBe(200);
    expect(res.body.shared).toHaveLength(1);
    expect(res.body.shared[0].id).toBe(documentId);
    expect(res.body.shared[0].permission).toBe('edit');
  });

  it('allows shared editor to read and edit document', async () => {
    const getRes = await request(app)
      .get(`/api/documents/${documentId}`)
      .set('Authorization', `Bearer ${bobToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.isOwner).toBe(false);
    expect(getRes.body.canEdit).toBe(true);

    const patchRes = await request(app)
      .patch(`/api/documents/${documentId}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ content: '<p>Updated by Bob</p>' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.document.content).toBe('<p>Updated by Bob</p>');
  });

  it('creates version history on content change', async () => {
    const res = await request(app)
      .get(`/api/documents/${documentId}/versions`)
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(res.status).toBe(200);
    expect(res.body.versions.length).toBeGreaterThan(0);
  });

  it('denies view-only user from editing', async () => {
    await request(app)
      .post(`/api/documents/${documentId}/share`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ email: 'carol@ajaia.test', permission: 'view' });

    const patchRes = await request(app)
      .patch(`/api/documents/${documentId}`)
      .set('Authorization', `Bearer ${carolToken}`)
      .send({ content: '<p>Hacked</p>' });

    expect(patchRes.status).toBe(403);
  });

  it('allows comment-only user to add comments but not edit', async () => {
    const doc2 = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Comment Test' });

    const doc2Id = doc2.body.document.id;

    await request(app)
      .post(`/api/documents/${doc2Id}/share`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ email: 'carol@ajaia.test', permission: 'comment' });

    const commentRes = await request(app)
      .post(`/api/documents/${doc2Id}/comments`)
      .set('Authorization', `Bearer ${carolToken}`)
      .send({ body: 'Please clarify this section' });

    expect(commentRes.status).toBe(201);

    const patchRes = await request(app)
      .patch(`/api/documents/${doc2Id}`)
      .set('Authorization', `Bearer ${carolToken}`)
      .send({ content: '<p>No edit</p>' });

    expect(patchRes.status).toBe(403);
  });

  it('allows author to edit and delete own comment', async () => {
    const doc2 = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ title: 'Edit Comment Test' });

    const doc2Id = doc2.body.document.id;

    const commentRes = await request(app)
      .post(`/api/documents/${doc2Id}/comments`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ body: 'Original comment' });

    expect(commentRes.status).toBe(201);
    const commentId = commentRes.body.comment.id;

    const editRes = await request(app)
      .patch(`/api/documents/${doc2Id}/comments/${commentId}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ body: 'Updated comment' });

    expect(editRes.status).toBe(200);
    expect(editRes.body.comment.body).toBe('Updated comment');

    await request(app)
      .post(`/api/documents/${doc2Id}/share`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ email: 'bob@ajaia.test', permission: 'view' });

    const bobEditRes = await request(app)
      .patch(`/api/documents/${doc2Id}/comments/${commentId}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ body: 'Hacked' });

    expect(bobEditRes.status).toBe(403);

    const deleteRes = await request(app)
      .delete(`/api/documents/${doc2Id}/comments/${commentId}`)
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(deleteRes.status).toBe(200);

    const listRes = await request(app)
      .get(`/api/documents/${doc2Id}/comments`)
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(listRes.body.comments).toHaveLength(0);
  });

  it('prevents non-owner from deleting document', async () => {
    const res = await request(app)
      .delete(`/api/documents/${documentId}`)
      .set('Authorization', `Bearer ${bobToken}`);

    expect(res.status).toBe(404);
  });
});
