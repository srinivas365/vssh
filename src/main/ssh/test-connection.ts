import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client, ConnectConfig } from 'ssh2';
import { VmInput, VaultEntry, VmConnectionTestResult } from '@shared/types';

const DEFAULT_TIMEOUT_MS = 10_000;

export async function testVmConnection(input: VmInput, secret: VaultEntry): Promise<VmConnectionTestResult> {
  let config: ConnectConfig;
  try {
    config = buildConnectConfig(input, secret);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid connection settings.';
    return { ok: false, latencyMs: null, message };
  }

  const startedAt = Date.now();
  return await new Promise<VmConnectionTestResult>((resolve) => {
    const client = new Client();
    let settled = false;

    const finish = (result: VmConnectionTestResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      client.end();
      resolve(result);
    };

    const timeout = setTimeout(() => {
      finish({
        ok: false,
        latencyMs: null,
        message: `Connection timed out after ${Math.round(DEFAULT_TIMEOUT_MS / 1000)}s.`,
      });
    }, DEFAULT_TIMEOUT_MS + 500);

    client.once('ready', () => {
      finish({
        ok: true,
        latencyMs: Date.now() - startedAt,
        message: 'Connection successful.',
      });
    });

    client.once('error', (error) => {
      finish({
        ok: false,
        latencyMs: null,
        message: formatSshError(error),
      });
    });

    client.connect(config);
  });
}

function buildConnectConfig(input: VmInput, secret: VaultEntry): ConnectConfig {
  const host = input.host.trim();
  const username = input.username.trim();
  if (!host) throw new Error('Host is required to test the connection.');
  if (!username) throw new Error('Username is required to test the connection.');
  if (!Number.isFinite(input.port) || input.port <= 0) throw new Error('Port must be a positive number.');

  const config: ConnectConfig = {
    host,
    port: input.port,
    username,
    readyTimeout: DEFAULT_TIMEOUT_MS,
  };

  let hasAuthMethod = false;
  const password = secret.password?.trim();
  if (input.authMethod !== 'key' && password) {
    config.password = password;
    hasAuthMethod = true;
  }

  if (input.authMethod !== 'password') {
    const trimmedKeyPath = input.keyPath?.trim();
    if (trimmedKeyPath) {
      const resolvedPath = resolveKeyPath(trimmedKeyPath);
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`SSH key not found at ${trimmedKeyPath}.`);
      }
      config.privateKey = fs.readFileSync(resolvedPath, 'utf8');
      const passphrase = secret.keyPassphrase?.trim();
      if (passphrase) config.passphrase = passphrase;
      hasAuthMethod = true;
    } else if (process.env.SSH_AUTH_SOCK) {
      config.agent = process.env.SSH_AUTH_SOCK;
      hasAuthMethod = true;
    }
  }

  if (!hasAuthMethod) {
    if (input.authMethod === 'password') {
      throw new Error('Enter a password to test this connection.');
    }
    if (input.authMethod === 'key') {
      throw new Error('Provide a key path or ensure ssh-agent is running to test this connection.');
    }
    throw new Error('Provide either a password or key path to test this connection.');
  }

  return config;
}

function resolveKeyPath(keyPath: string): string {
  if (keyPath.startsWith('~/')) {
    return path.join(os.homedir(), keyPath.slice(2));
  }
  return keyPath;
}

function formatSshError(error: unknown): string {
  if (error && typeof error === 'object') {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOTFOUND') return 'Host not found. Verify the hostname or DNS.';
    if (err.code === 'ECONNREFUSED') return 'Connection refused. Check the host and SSH port.';
    if (err.code === 'ETIMEDOUT') return 'Connection timed out.';
    if (typeof err.message === 'string' && err.message.includes('All configured authentication methods failed')) {
      return 'Authentication failed. Verify credentials and selected auth method.';
    }
    if (typeof err.message === 'string' && err.message.trim().length > 0) {
      return err.message;
    }
  }
  return 'SSH connection failed.';
}
