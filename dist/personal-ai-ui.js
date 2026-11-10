export function openPersonalAI({modal,client,makeClient,switchAccount,onUpdate}) {
 const profile=client().personalAccount;
 const dialog=modal(profile?
  `<p>个人账号 <b>${profile.username}</b> · 使用自己的 DeepSeek 配额。</p>
  <p>${profile.configured?'已保存密钥（末四位 '+profile.tail+'）':'还没有保存密钥。'}</p>
  <form><label>DeepSeek API Key <input name="key" type="password" autocomplete="off" required></label>
  <button type="submit" value="key" class="primary">保存或更换密钥</button></form>
  ${profile.configured?'<button type="button" data-personal="remove">移除密钥</button>':''}
  <button type="button" data-personal="logout">退出个人账号</button>`:
  `<p>登录后可绑定自己的 DeepSeek API Key。本浏览器的个人工作空间和游客工作空间分开保存。</p>
  <form><label>用户名 <input name="username" pattern="[A-Za-z]{3}[0-9]{4}" placeholder="abc1234" autocomplete="username" required></label>
  <label>六位数字密码 <input name="password" type="password" inputmode="numeric" pattern="[0-9]{6}" autocomplete="current-password" required></label>
  <button type="submit" value="login" class="primary">登录</button>
  <button type="submit" value="register">注册</button></form>`,'个人 AI 账号');
 const message=document.createElement('p');
 message.setAttribute('role','status');
 dialog.append(message);
 async function perform(work) {
  const controls=[...dialog.querySelectorAll('button,input')];
  controls.forEach(control=>control.disabled=true);
  message.textContent='正在处理…';
  try{await work();}catch(error){message.textContent=error.message;}finally{controls.forEach(control=>control.disabled=false);}
 }
 dialog.querySelector('form').onsubmit=event=>{
  event.preventDefault();
  const values=Object.fromEntries(new FormData(event.target));
  const operation=event.submitter?.value||(profile?'key':'login');
  perform(async()=>{
   if(profile){onUpdate(await client().request('/api/personal/key',{key:values.key.trim()}));dialog.close();return;}
   const account=await makeClient().request('/api/personal/'+operation,values);
   await switchAccount(account);
   dialog.close();
   if(operation==='register')openPersonalAI({modal,client,makeClient,switchAccount,onUpdate});
  });
 };
 dialog.querySelector('[data-personal="remove"]')?.addEventListener('click',()=>{
  if(confirm('移除当前账号的模型密钥？'))perform(async()=>{onUpdate(await client().request('/api/personal/key',{key:null}));dialog.close();});
 });
 dialog.querySelector('[data-personal="logout"]')?.addEventListener('click',()=>perform(async()=>{
  try{await client().request('/api/personal/logout',{});}catch(error){if(error.status!==401)throw error;}
  await switchAccount(null);
  dialog.close();
 }));
}
