// Genera config.js (leido por index.html) a partir de la variable API_URL en .env,
// ya que index.html es estatico (GitHub Pages) y no puede leer .env en tiempo de ejecucion.
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const match = envContent.match(/^API_URL=(.*)$/m);
const apiUrl = (match ? match[1] : 'http://localhost:3000').trim().replace(/^["']|["']$/g, '');

const configPath = path.join(__dirname, '..', 'config.js');
fs.writeFileSync(configPath, `// Generado por scripts/generate-frontend-config.js a partir de .env (API_URL). No editar a mano.\nwindow.API_URL = "${apiUrl}";\n`, 'utf8');
console.log('config.js generado con API_URL =', apiUrl);
