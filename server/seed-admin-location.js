require('dotenv').config({ path: './.env' });
const { MongoClient } = require('mongodb');

async function run() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();
  const result = await db.collection('users').updateOne(
    { email: 'testadmin001@abc.com' },
    { $set: { location: { lat: 31.264905, lng: 75.700219 } } }
  );
  console.log('matched:', result.matchedCount, 'modified:', result.modifiedCount);
  await client.close();
}

run().catch(console.error);
