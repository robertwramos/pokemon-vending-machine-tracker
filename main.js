const { execSync } = require('child_process');

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

try {
  run('npm install');
  run('npm run build');
  run('npm run db:push');
  run('npm run deploy:commands');
  run('npm prune --omit=dev');
  run('node dist/index.js');
} catch (err) {
  console.error('Startup failed:', err.message);
  process.exit(1);
}
