import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

import pkg from 'pg';

const { Client } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(__dirname, '../infra/sql/schema.sql');

const host = process.env.POSTGRES_HOST;
const port = Number(process.env.POSTGRES_PORT || '5432');
const user = process.env.POSTGRES_USER;
const password = process.env.POSTGRES_PASSWORD;
const database = process.env.POSTGRES_DB || 'vechart';

if (!host || !user || !password) {
  console.error('Missing POSTGRES_HOST, POSTGRES_USER, or POSTGRES_PASSWORD.');
  process.exit(1);
}

const adminClient = new Client({
  host,
  port,
  user,
  password,
  database: 'postgres',
  ssl: false
});

await adminClient.connect();
const exists = await adminClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
if (exists.rowCount === 0) {
  await adminClient.query(`CREATE DATABASE "${database}"`);
  console.log(`Created database ${database}`);
} else {
  console.log(`Database ${database} already exists`);
}
await adminClient.end();

const appClient = new Client({
  host,
  port,
  user,
  password,
  database,
  ssl: false
});

await appClient.connect();
const schemaSql = await fs.readFile(schemaPath, 'utf8');
await appClient.query(schemaSql);
console.log('Applied schema');

const { rows } = await appClient.query('SELECT COUNT(*)::int AS count FROM users');
if (rows[0].count === 0) {
  await appClient.query(`
    INSERT INTO users (id, name, email, password_hash, role, status)
    VALUES
      ('user-admin', 'Admin', 'admin@vechart.local', 'admin123', 'admin', 'active'),
      ('user-editor', 'Editor', 'editor@vechart.local', 'editor123', 'editor', 'active')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO albums (id, name, slug, description, cover_photo_id)
    VALUES
      ('album-bags', '包包', 'bags', '适合通勤与礼品场景的包包集合', 'photo-bag-1'),
      ('album-pendants', '挂件', 'pendants', '新品挂件与配件资料', 'photo-pendant-1')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO photos (
      id, album_id, storage_key_original, storage_key_thumbnail, storage_key_preview, created_by
    )
    VALUES
      ('photo-bag-1', 'album-bags', 'https://images.unsplash.com/photo-bag-1?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-bag-1?auto=format&fit=crop&w=600&q=80', 'https://images.unsplash.com/photo-bag-1?auto=format&fit=crop&w=600&q=80', 'user-admin'),
      ('photo-bag-2', 'album-bags', 'https://images.unsplash.com/photo-bag-2?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-bag-2?auto=format&fit=crop&w=600&q=80', 'https://images.unsplash.com/photo-bag-2?auto=format&fit=crop&w=600&q=80', 'user-admin'),
      ('photo-pendant-1', 'album-pendants', 'https://images.unsplash.com/photo-pendant-1?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-pendant-1?auto=format&fit=crop&w=600&q=80', 'https://images.unsplash.com/photo-pendant-1?auto=format&fit=crop&w=600&q=80', 'user-admin'),
      ('photo-pendant-2', 'album-pendants', 'https://images.unsplash.com/photo-pendant-2?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-pendant-2?auto=format&fit=crop&w=600&q=80', 'https://images.unsplash.com/photo-pendant-2?auto=format&fit=crop&w=600&q=80', 'user-admin')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO photo_product_metadata (
      photo_id, product_name, material, product_url, supplier_1688_url, market_price, estimated_cost, moq, note, updated_by
    )
    VALUES
      ('photo-bag-1', '托特包 A', '牛皮', 'https://example.com/product', 'https://detail.1688.com/offer/example.html', 299, 128, 50, '首版示例数据', 'user-admin'),
      ('photo-bag-2', '斜挎包 B', '帆布', 'https://example.com/product', 'https://detail.1688.com/offer/example.html', 189, 78, 80, '首版示例数据', 'user-admin'),
      ('photo-pendant-1', '熊猫挂件', '合金', 'https://example.com/product', 'https://detail.1688.com/offer/example.html', 59, 18, 200, '首版示例数据', 'user-admin'),
      ('photo-pendant-2', '猫爪挂件', 'PVC', 'https://example.com/product', 'https://detail.1688.com/offer/example.html', 39, 9, 300, '首版示例数据', 'user-admin')
    ON CONFLICT (photo_id) DO NOTHING;
  `);

  await appClient.query(`
    INSERT INTO share_documents (id, title, description, created_by, template_version, status)
    VALUES ('share-launch', '春季新品推荐', '给渠道客户的新品展示', 'user-admin', 'v1', 'ready')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO share_document_items (id, share_document_id, photo_id, sort_order, snapshot_json)
    VALUES
      ('share-item-1', 'share-launch', 'photo-bag-1', 0, '{"productName":"托特包 A","material":"牛皮","productUrl":"https://example.com/product","product1688Url":"https://detail.1688.com/offer/example.html","marketPrice":299,"estimatedCost":128,"moq":50,"note":"首版示例数据","imageUrl":"https://images.unsplash.com/photo-bag-1?auto=format&fit=crop&w=1200&q=80","thumbnailUrl":"https://images.unsplash.com/photo-bag-1?auto=format&fit=crop&w=600&q=80"}'),
      ('share-item-2', 'share-launch', 'photo-pendant-1', 1, '{"productName":"熊猫挂件","material":"合金","productUrl":"https://example.com/product","product1688Url":"https://detail.1688.com/offer/example.html","marketPrice":59,"estimatedCost":18,"moq":200,"note":"首版示例数据","imageUrl":"https://images.unsplash.com/photo-pendant-1?auto=format&fit=crop&w=1200&q=80","thumbnailUrl":"https://images.unsplash.com/photo-pendant-1?auto=format&fit=crop&w=600&q=80"}')
    ON CONFLICT (id) DO NOTHING;
  `);
  console.log('Seeded initial data');
} else {
  console.log('Seed data already present');
}

await appClient.end();
