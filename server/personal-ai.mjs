import {classroomError,digest,passwordRecord,randomToken,verifyPassword} from './classroom-auth.mjs';

const personalEncoder = new TextEncoder();
const personalDecoder = new TextDecoder();
export const personalToken = token => /^byok\.[A-Za-z0-9_-]{43}$/.test(token);
const usernamePattern = /^[a-z]{3}[0-9]{4}$/;
const passwordPattern = /^[0-9]{6}$/;

export class PersonalAIService {
  constructor(store, env, network) {
    this.store = store;
    this.env = env;
    this.network = network || 'unknown';
  }

  get enabled() {
    return /^[a-f0-9]{64}$/i.test(this.env.PERSONAL_AI_ENCRYPTION_KEY || '');
  }

  async rate(key, limit, windowMs) {
    const bucket = Math.floor(Date.now() / windowMs);
    await this.store.update('personal-rate:' + key, old => {
      const count = old?.bucket === bucket ? old.count : 0;
      if (count >= limit) throw classroomError('操作过于频繁，请稍后再试', 429);
      return {bucket, count:count + 1};
    });
  }

  secretBytes() {
    return Uint8Array.from(this.env.PERSONAL_AI_ENCRYPTION_KEY.match(/../g), x => parseInt(x, 16));
  }

  async protectedPassword(password) {
    const key = await crypto.subtle.importKey('raw', this.secretBytes(), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
    const result = await crypto.subtle.sign('HMAC', key, personalEncoder.encode('museradar:pin:v1:' + password));
    return btoa(String.fromCharCode(...new Uint8Array(result)));
  }

  async cryptKey() {
    return crypto.subtle.importKey('raw', this.secretBytes(), 'AES-GCM', false, ['encrypt','decrypt']);
  }

  async register(input) {
    const username = typeof input.username === 'string' ? input.username.trim().toLowerCase() : '';
    if (!usernamePattern.test(username) || typeof input.password !== 'string' || !passwordPattern.test(input.password)) {
      throw classroomError('用户名须为三个英文字母加四位数字，密码须为六位数字');
    }
    if (username === 'hxz1103') throw classroomError('这个用户名已保留', 409);
    await this.rate('register:' + await digest(this.network + this.env.SESSION_SALT), 5, 3600000);
    const password = await passwordRecord(await this.protectedPassword(input.password));
    const account = {username, id:crypto.randomUUID(), password};
    await this.store.update('personal-user:' + username, old => {
      if (old) throw classroomError('这个用户名已使用', 409);
      return account;
    });
    return this.issue(account);
  }

  async login(input) {
    const username = typeof input.username === 'string' ? input.username.trim().toLowerCase() : '';
    if (!usernamePattern.test(username) || typeof input.password !== 'string' || !passwordPattern.test(input.password)) {
      throw classroomError('用户名或密码不正确', 401);
    }
    await this.rate('login-ip:' + await digest(this.network + this.env.SESSION_SALT), 30, 600000);
    await this.rate('login-user:' + username, 8, 600000);
    const account = await this.store.get('personal-user:' + username);
    if (!await verifyPassword(await this.protectedPassword(input.password), account?.password)) throw classroomError('用户名或密码不正确', 401);
    return this.issue(account);
  }

  async issue(account) {
    const token = 'byok.' + randomToken();
    await this.store.put('personal-session:' + await digest(token), {
      username:account.username, id:account.id, expires:Date.now() + 4*3600000
    });
    return {token, ...this.summary(account)};
  }

  summary(account) {
    return {username:account.username, id:account.id, configured:!!account.encryptedKey, tail:account.tail || ''};
  }

  async authenticate(token) {
    if (!personalToken(token)) throw classroomError('请登录个人账号', 401);
    const session = await this.store.get('personal-session:' + await digest(token));
    if (!session || session.expires <= Date.now()) throw classroomError('个人会话已过期，请重新登录', 401);
    const account = await this.store.get('personal-user:' + session.username);
    if (account?.id !== session.id) throw classroomError('个人会话已失效，请重新登录', 401);
    return account;
  }

  async saveKey(account, value) {
    if (value !== null && (typeof value !== 'string' || !/^sk-[A-Za-z0-9_-]{16,200}$/.test(value))) {
      throw classroomError('请输入有效的 DeepSeek API Key');
    }
    let encryptedKey = null;
    if (value !== null) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const data = await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:personalEncoder.encode(account.id)},await this.cryptKey(),personalEncoder.encode(value));
      encryptedKey = {iv:Array.from(iv), data:Array.from(new Uint8Array(data))};
    }
    const updated = await this.store.update('personal-user:' + account.username, current => {
      if (current?.id !== account.id) throw classroomError('个人会话已失效', 401);
      return {...current,encryptedKey,tail:value?.slice(-4) || ''};
    });
    return this.summary(updated);
  }

  async modelKey(account) {
    if (!account.encryptedKey) throw classroomError('请先保存个人 DeepSeek API Key', 409);
    const {iv,data} = account.encryptedKey;
    const plaintext = await crypto.subtle.decrypt({name:'AES-GCM',iv:Uint8Array.from(iv),additionalData:personalEncoder.encode(account.id)},await this.cryptKey(),Uint8Array.from(data));
    return personalDecoder.decode(plaintext);
  }

  async logout(token) {
    await this.authenticate(token);
    await this.store.remove('personal-session:' + await digest(token));
    return {ok:true};
  }
}
