import test from 'node:test';
import assert from 'node:assert/strict';
import { createOAuthAuthorizationServerMetadata } from '../../control-plane/scripts/oauth-authorization-server.mjs';

const provider = {
  clientsStore: { registerClient() {} },
  revokeToken() {},
  authorizationResponseIssParameterSupported: true
};

test('non-loopback HTTP OAuth issuer is rejected unless LAN HTTP is explicitly enabled', () => {
  const issuerUrl = new URL('http://abc:8101');
  const resourceServerUrl = new URL('http://abc:8101/mcp');
  assert.throws(
    () => createOAuthAuthorizationServerMetadata({ provider, issuerUrl, resourceServerUrl }),
    /Issuer URL must be HTTPS/
  );
  const metadata = createOAuthAuthorizationServerMetadata({
    provider,
    issuerUrl,
    resourceServerUrl,
    dangerouslyAllowInsecureIssuerUrl: true
  });
  assert.equal(metadata.issuer, 'http://abc:8101/');
  assert.equal(metadata.authorization_endpoint, 'http://abc:8101/authorize');
  assert.equal(metadata.token_endpoint, 'http://abc:8101/token');
  assert.equal(metadata.registration_endpoint, 'http://abc:8101/register');
  assert.equal(metadata.revocation_endpoint, 'http://abc:8101/revoke');
});
