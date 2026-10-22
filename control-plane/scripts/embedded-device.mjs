import { createHash, randomBytes } from 'node:crypto';
import os from 'node:os';

/**
 * The server's Device is claimed through the existing account/pairing store.
 * This controller never assigns an owner itself and never creates a local auth bypass.
 * Only the transport of the proven Device session is in-process.
 */
export async function createEmbeddedDeviceController({
  broker, deviceStore, pairingStore, identity, core, baseUrl, deviceName,
  onPairing = () => {}, pollIntervalMs = 2000
}) {
  if (!broker || !deviceStore || !pairingStore || !identity || !core) {
    throw new Error('Embedded Device requires broker, stores, identity and shared Device Core.');
  }
  const record = await identity.loadOrCreate();
  let endpoint = null;
  let pairing = null;
  let timer = null;
  let closed = false;
  let busy = false;
  let fault = null;
  let unsubscribeCapabilities = null;
  const metadata = {
    agentVersion: 'mcp-device', packageVersion: core.version || '1.0.12',
    hostname: os.hostname(), platform: process.platform, arch: process.arch,
    pathStyle: process.platform === 'win32' ? 'windows' : 'posix',
    runtimeReady: true, executionRuntimeGeneration: core.runtimeInstanceId
  };

  function status() {
    const stored = deviceStore.get(record.deviceId);
    return {
      device_id: record.deviceId,
      state: closed ? 'closed' : endpoint?.isOpen() ? 'online' : fault ? 'faulted' : 'pairing_required',
      owner_account_id: stored?.ownerAccountId || null,
      ...(pairing ? {
        user_code: pairing.userCode,
        verification_uri_complete: baseUrl + '/device/verify?user_code=' + encodeURIComponent(pairing.userCode),
        expires_at: pairing.expiresAt
      } : {}),
      ...(fault ? { error: fault } : {})
    };
  }

  async function connect(enrollmentGrant) {
    endpoint?.close();
    endpoint = await broker.attachLocalDevice({
      deviceId: record.deviceId, publicKeyPem: record.publicKeyPem,
      signChallenge: nonce => identity.signChallenge(nonce),
      invoke: (tool, args) => core.invoke(tool, args),
      capabilities: core.capabilities, ...metadata,
      ...(enrollmentGrant ? { enrollmentGrant } : {})
    });
    await identity.markEnrolled();
    fault = null;
    pairing = null;
    clearTimeout(timer);
    timer = null;
    return status();
  }

  async function checkPairing() {
    if (closed || !pairing || busy) return status();
    busy = true;
    try {
      const current = pairingStore.getStatusByUserCode(pairing.userCode);
      if (current.status === 'expired') {
        fault = 'PAIRING_EXPIRED';
        clearTimeout(timer);
        return status();
      }
      if (current.status === 'approved') {
        const result = pairingStore.poll({
          deviceCode: pairing.deviceCode,
          clientId: pairing.clientId,
          codeVerifier: pairing.codeVerifier
        });
        await connect(result.enrollmentGrant);
      }
    } catch (error) {
      fault = String(error?.code || error?.message || 'PAIRING_FAILED').slice(0, 180);
    } finally {
      busy = false;
    }
    return status();
  }

  function schedule() {
    clearTimeout(timer);
    if (closed || !pairing || fault) return;
    timer = setTimeout(async () => {
      await checkPairing();
      schedule();
    }, Math.max(100, pollIntervalMs));
    timer.unref?.();
  }

  function beginPairing() {
    if (closed) throw new Error('Embedded Device controller is closed.');
    if (busy) throw new Error('Embedded Device pairing is busy.');
    if (endpoint?.isOpen()) return status();
    const codeVerifier = randomBytes(32).toString('base64url');
    const clientId = 'mcp-device-embedded-v1';
    const started = pairingStore.start({
      clientId, deviceId: record.deviceId,
      deviceName: deviceName || os.hostname(),
      publicKeyPem: record.publicKeyPem,
      codeChallenge: createHash('sha256').update(codeVerifier).digest('base64url')
    });
    pairing = { ...started, clientId, codeVerifier, expiresAt: Date.now() + started.expiresIn * 1000 };
    fault = null;
    schedule();
    onPairing(status());
    return status();
  }

  async function start() {
    const stored = deviceStore.get(record.deviceId);
    if (stored && !stored.revokedAt && stored.ownerAccountId) {
      if (stored.publicKeyPem !== record.publicKeyPem) {
        throw new Error('Embedded Device identity does not match enrolled public key.');
      }
      return await connect();
    }
    return beginPairing();
  }

  async function close() {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    unsubscribeCapabilities?.();
    unsubscribeCapabilities = null;
    endpoint?.close();
    endpoint = null;
    pairing = null;
  }

  await start();
  if (typeof core.onCapabilitiesChanged === 'function') {
    unsubscribeCapabilities = core.onCapabilitiesChanged(() => endpoint?.updateCapabilities(core.capabilities));
  }
  return {
    status, beginPairing, checkPairing,
    refreshCapabilities() { endpoint?.updateCapabilities(core.capabilities); },
    close
  };
}
