import pg from 'pg';
const { Client } = pg;

const passwords = [
  "7s9Ls5J7kL23pPjLuPuME0j2uscFnWiX",
  "7s9Ls5J7kL23pPjLuPuMEOj2uscFnWiX",
  "7s9Ls5J7kI23pPjLuPuME0j2uscFnWiX",
  "7s9Ls5J7kl23pPjLuPuME0j2uscFnWiX",
  "7s9Ls5J7kL23pPjLuPuME0j2uscFnWlX",
  "7s9Ls5J7kL23pPjLuPuMEOj2uscFnWlX",
  "7s8Ls5J7kL23pPjLuPuME0j2uscFnWiX",
  "7s8Ls5J7kL23pPjLuPuMEOj2uscFnWiX"
];

async function testPasswords() {
  for (const pwd of passwords) {
    const client = new Client({
      connectionString: `postgresql://document_ai_db_hi8k_user:${pwd}@dpg-d91k8t28qa3s73apcbo0-a.oregon-postgres.render.com/document_ai_db_hi8k?sslmode=require`
    });
    try {
      await client.connect();
      console.log("SUCCESS:", pwd);
      await client.end();
      return;
    } catch (e) {
      console.log("Failed:", pwd, e.message);
    }
  }
}
testPasswords();
