import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const passwordsToTry = [
  '7s8Ls5J7kL23pPjLuPuMEOj2uscfnWiX',
  '7s8Ls5J7kL23pPjLuPuME0j2uscfnWiX',
  '7s8Ls5J7kL23pPjLuPuMEOj2uscFnWiX',
  '7s8Ls5J7kL23pPjLuPuME0j2uscFnWiX',
  '7s9Ls5J7kL23pPjLuPuMEOj2uscfnWiX',
  '7s8ls5J7kL23pPjLuPuMEOj2uscfnWiX',
  '7s8Ls5J7kl23pPjLuPuMEOj2uscfnWiX'
];

async function testPassword(pwd) {
  const client = new pg.Client({
    user: 'document_ai_db_hi8k_user',
    password: pwd,
    host: 'dpg-d91k8t28qa3s73apcbo0-a.oregon-postgres.render.com',
    port: 5432,
    database: 'document_ai_db_hi8k',
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    console.log('SUCCESS with password:', pwd);
    await client.end();
    return true;
  } catch (err) {
    // console.log('Failed with password:', pwd);
    return false;
  }
}

async function run() {
  for (const p of passwordsToTry) {
    if (await testPassword(p)) {
      process.exit(0);
    }
  }
  console.log('All passwords failed');
}

run();
