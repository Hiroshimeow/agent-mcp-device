const fs = require('fs');
const path = require('path');
const { X509Certificate } = require('crypto');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'src', 'data', 'official-app-ca.pem');
const destination = path.join(root, 'dist', 'data', 'official-app-ca.pem');

fs.mkdirSync(path.dirname(destination), { recursive: true });
if (!fs.existsSync(source)) {
  fs.rmSync(destination, { force: true });
  process.exit(0);
}

const pem = fs.readFileSync(source, 'utf8');
const certificate = new X509Certificate(pem);
if (!certificate.ca) throw new Error('official-app-ca.pem is not marked as a CA certificate');
fs.writeFileSync(destination, pem.endsWith('\n') ? pem : `${pem}\n`, { mode: 0o644 });
