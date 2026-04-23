require('dotenv').config({ path: './.env' });
const { MongoClient } = require('mongodb');

async function run() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();
  const result = await db.collection('users').updateOne(
    { email: 'testuser001@abc.com' },
    { $set: { location: { lat: 31.326000, lng: 75.575600 } } }
  );
  console.log('matched:', result.matchedCount, 'modified:', result.modifiedCount);
  if (result.matchedCount === 0) {
    console.log('No user found with email testuser001@abc.com');
  } else {
    console.log('Location updated to Lat: 31.326000, Lng: 75.575600');
  }
  await client.close();
}

run().catch(console.error);
