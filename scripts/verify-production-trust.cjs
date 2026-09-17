const fs = require('fs');
const path = require('path');
const { X509Certificate } = require('crypto');

const root = path.resolve(__dirname, '..');
const caPath = path.join(root, 'src', 'data', 'official-app-ca.pem');

if (!fs.existsSync(caPath)) {
  console.error('MCP Device publish blocked: src/data/official-app-ca.pem is missing. Provision the independently distributed production application CA before packing or publishing.');
  process.exit(1);
}

try {
  const pem = fs.readFileSync(caPath, 'utf8');
  const certificate = new X509Certificate(pem);
  if (!certificate.ca) throw new Error('certificate is not marked as a CA');
} catch (error) {
  console.error(`MCP Device publish blocked: official application CA is invalid: ${error.message}`);
  process.exit(1);
}

console.log('MCP Device production application CA preflight passed.');
