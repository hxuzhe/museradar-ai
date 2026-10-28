// Converts a password supplied on hidden stdin to a salted record. Never writes plaintext.
import {passwordRecord} from '../server/classroom-auth.mjs';
const input=await new Promise((resolve,reject)=>{let value='';const tty=process.stdin.isTTY;const finish=()=>{process.stdin.removeAllListeners('data');if(tty)process.stdin.setRawMode(false);process.stdin.pause();resolve(value.trim());};if(tty){process.stdin.setRawMode(true);process.stderr.write('Ready for authorization password on hidden stdin.\n');}process.stdin.setEncoding('utf8');process.stdin.on('data',chunk=>{value+=chunk;if(value.includes('\u0003'))reject(Error('Cancelled'));else if(/[\r\n]/.test(value))finish();});process.stdin.once('end',finish);process.stdin.resume();});
console.log(JSON.stringify(await passwordRecord(input)));
