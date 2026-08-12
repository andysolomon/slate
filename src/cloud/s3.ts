/** S3-backed account gallery. One bucket, per-user prefix
 *  `users/{cognito-identity-id}/scenes/{sceneId}.json`, plus
 *  `users/{id}/meta.json` holding the gallery index. AWS credentials come from
 *  a Cognito Identity Pool that trusts Google sign-in; the IAM policy scopes
 *  each identity to its own prefix (see README). */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { CognitoIdentityClient, GetIdCommand, GetCredentialsForIdentityCommand } from '@aws-sdk/client-cognito-identity';
import type { Scene, SceneMeta } from '../types';
import { ENV } from './google';

export class CloudStore {
  identityId = '';
  private s3: S3Client | null = null;
  private expiresAt = 0;
  private idToken: string;

  constructor(idToken: string) {
    this.idToken = idToken;
  }

  setToken(idToken: string): void {
    this.idToken = idToken;
    this.s3 = null;
  }

  get expired(): boolean {
    return Date.now() > this.expiresAt - 60_000;
  }

  async init(): Promise<void> {
    const cognito = new CognitoIdentityClient({ region: ENV.region });
    const logins = { 'accounts.google.com': this.idToken };
    const idResp = await cognito.send(new GetIdCommand({ IdentityPoolId: ENV.identityPoolId, Logins: logins }));
    if (!idResp.IdentityId) throw new Error('Cognito returned no identity.');
    this.identityId = idResp.IdentityId;
    const credResp = await cognito.send(new GetCredentialsForIdentityCommand({ IdentityId: this.identityId, Logins: logins }));
    const c = credResp.Credentials;
    if (!c || !c.AccessKeyId || !c.SecretKey) throw new Error('Cognito returned no credentials.');
    this.expiresAt = c.Expiration ? c.Expiration.getTime() : Date.now() + 55 * 60_000;
    this.s3 = new S3Client({
      region: ENV.region,
      credentials: { accessKeyId: c.AccessKeyId, secretAccessKey: c.SecretKey, sessionToken: c.SessionToken },
    });
  }

  private client(): S3Client {
    if (!this.s3) throw new Error('Cloud storage is not connected.');
    return this.s3;
  }

  private key(rest: string): string {
    return 'users/' + this.identityId + '/' + rest;
  }

  async putScene(scene: Scene): Promise<void> {
    await this.client().send(new PutObjectCommand({
      Bucket: ENV.bucket,
      Key: this.key('scenes/' + scene.id + '.json'),
      Body: JSON.stringify(scene),
      ContentType: 'application/json',
    }));
  }

  async getScene(id: string): Promise<Scene | null> {
    try {
      const resp = await this.client().send(new GetObjectCommand({ Bucket: ENV.bucket, Key: this.key('scenes/' + id + '.json') }));
      const text = await resp.Body!.transformToString();
      return JSON.parse(text) as Scene;
    } catch (err: any) {
      if (err && (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404)) return null;
      throw err;
    }
  }

  async deleteScene(id: string): Promise<void> {
    await this.client().send(new DeleteObjectCommand({ Bucket: ENV.bucket, Key: this.key('scenes/' + id + '.json') }));
  }

  async getMeta(): Promise<SceneMeta[]> {
    try {
      const resp = await this.client().send(new GetObjectCommand({ Bucket: ENV.bucket, Key: this.key('meta.json') }));
      const text = await resp.Body!.transformToString();
      const data = JSON.parse(text);
      return Array.isArray(data) ? data : [];
    } catch (err: any) {
      if (err && (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404)) return [];
      throw err;
    }
  }

  async putMeta(metas: SceneMeta[]): Promise<void> {
    await this.client().send(new PutObjectCommand({
      Bucket: ENV.bucket,
      Key: this.key('meta.json'),
      Body: JSON.stringify(metas),
      ContentType: 'application/json',
    }));
  }
}
