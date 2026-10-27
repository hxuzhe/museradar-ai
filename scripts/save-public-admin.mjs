import {savePrivateData} from '../server/settings-vault.mjs';
import {resolve} from 'node:path';
if(process.stdin.isTTY)process.stdin.setRawMode(true);
process.stdout.write('Waiting for private administration settings on stdin (input hidden).\n');
let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',async chunk=>{input+=chunk;if(!input.includes('\n'))return;process.stdin.pause();if(process.stdin.isTTY)process.stdin.setRawMode(false);try{const data=JSON.parse(input.trim());if(new URL(data.backend).protocol!=='https:'||typeof data.adminToken!=='string'||data.adminToken.length<32)throw Error();await savePrivateData({dataDir:resolve('.local/museradar')},'classroom-teacher',data);input='';console.log(JSON.stringify({savedEncrypted:true}));process.exit(0);}catch{input='';console.error('Could not save encrypted administration settings.');process.exit(1);}});
