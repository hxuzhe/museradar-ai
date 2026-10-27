import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createApp,configFromEnv} from '../server/index.mjs';
import {loadModelSettings} from '../server/settings-vault.mjs';
process.chdir(resolve(fileURLToPath(new URL('../',import.meta.url))));
if(Number(process.versions.node.split('.')[0])<22){console.error('Please install Node.js 22 or newer: https://nodejs.org/');process.exit(1);}
const config={...configFromEnv(),host:'127.0.0.1',localSetup:true,uiConfig:true,accessToken:randomBytes(32).toString('hex')};
try{await loadModelSettings(config);}catch{console.warn('Saved settings could not be opened. Configure the model in the browser again.');}
let server,port=config.port;
for(let attempt=0;attempt<5;attempt++){server=createApp(config);try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});break;}catch(e){if(e.code!=='EADDRINUSE'||attempt===4)throw e;port++;}}
const url='http://127.0.0.1:'+port+'/?setup=1#overview';
console.log('\nMuseRadar AI is ready: '+url+'\nKeep this window open. Press Ctrl+C to stop.\nConfigure DeepSeek in the browser. No model key is printed.');
if(!process.argv.includes('--no-open')){if(process.platform==='win32'){const child=spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{windowsHide:true,stdio:'ignore'});child.on('error',()=>console.log('Open the local URL in your browser.'));}else console.log('Open the local URL in your browser.');}
process.on('SIGINT',()=>server.close(()=>process.exit(0)));
