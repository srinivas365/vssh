import { Client, ConnectConfig, SFTPWrapper } from 'ssh2';
import type { Vm, VaultEntry } from '@shared/types';

export interface SftpConnection {
  client: Client;
  sftp: SFTPWrapper;
  close: () => void;
}

export function connectConfigForVm(vm: Vm, secret: VaultEntry | null): ConnectConfig {
  const config: ConnectConfig = {
    host: vm.host,
    port: vm.port,
    username: vm.username,
    readyTimeout: 20_000,
  };

  if (vm.keyPath) config.privateKey = undefined;
  if (secret?.password && vm.authMethod !== 'key') config.password = secret.password;

  return config;
}

export function connectSftp(vm: Vm, secret: VaultEntry | null): Promise<SftpConnection> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    client.once('ready', () => {
      client.sftp((err, sftp) => {
        if (err) {
          client.end();
          reject(err);
          return;
        }
        resolve({ client, sftp, close: () => client.end() });
      });
    });
    client.once('error', (err) => { client.end(); reject(err); });
    client.connect(connectConfigForVm(vm, secret));
  });
}
