/**
 * Generate a secure random key for UPDATE_AUTH_KEY
 * Use this to create a secure key for the update-data endpoint
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function generateSecureKey(length = 40) {
  return crypto
    .randomBytes(length)
    .toString('base64')
    .replace(/[+\/=]/g, '')
    .substring(0, length);
}

async function promptQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer));
  });
}

async function main() {
  console.log('🔑 Secure Update Auth Key Generator 🔑');
  console.log('=====================================\n');

  // Generate the key
  const authKey = generateSecureKey();
  console.log(`Generated key: ${authKey}\n`);
  console.log('This key should be used as your UPDATE_AUTH_KEY environment variable.');
  console.log('It will be required to authenticate requests to the /api/update-data endpoint.\n');

  // Ask if user wants to update .env file
  const updateEnv = await promptQuestion('Update .env file with this key? (yes/no): ');

  if (updateEnv.toLowerCase() === 'yes') {
    try {
      const envPath = path.join(process.cwd(), '.env');
      let envContent = '';

      // Read existing .env if it exists
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      }

      // Check if UPDATE_AUTH_KEY is already in the file
      if (envContent.includes('UPDATE_AUTH_KEY=')) {
        // Replace existing key
        envContent = envContent.replace(/UPDATE_AUTH_KEY=.*/, `UPDATE_AUTH_KEY=${authKey}`);
      } else {
        // Add new key
        envContent += `\nUPDATE_AUTH_KEY=${authKey}`;
      }

      // Write updated content
      fs.writeFileSync(envPath, envContent);
      console.log('✅ .env file updated with the new auth key.');
    } catch (error) {
      console.error('❌ Error updating .env file:', error.message);
    }
  }

  // Remind about setting in Vercel
  console.log('\n⚠️ Remember to also update this key in your Vercel environment variables!');
  console.log('https://vercel.com/dashboard → Project → Settings → Environment Variables\n');

  rl.close();
}

main();
