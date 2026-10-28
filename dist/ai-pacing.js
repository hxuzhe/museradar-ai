export function abortableWait(ms,signal){return new Promise((resolve,reject)=>{if(signal?.aborted){reject(new DOMException('任务已暂停','AbortError'));return;}const finish=()=>{signal?.removeEventListener('abort',abort);resolve();},timer=setTimeout(finish,Math.max(0,ms)),abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(new DOMException('任务已暂停','AbortError'));};signal?.addEventListener('abort',abort,{once:true});});}
export class ModelPacer {
 constructor({now=()=>Date.now(),sleep=abortableWait}={}){this.now=now;this.sleep=sleep;this.nextAt=0;this.perMinute=20;}
 async wait(signal,onWait){const now=this.now(),at=Math.max(now,this.nextAt),gap=Math.ceil(60000/Math.max(1,this.perMinute))+150;this.nextAt=at+gap;const delay=at-now;if(delay>0){onWait?.(delay,'正在控制请求节奏');await this.sleep(delay,signal);}}
 async cooldown(seconds,signal,onWait){const delay=Math.min(65000,Math.max(1000,seconds*1000));this.nextAt=Math.max(this.nextAt,this.now()+delay);onWait?.(delay,'网络限频，等待后自动继续');await this.sleep(delay,signal);}
}
