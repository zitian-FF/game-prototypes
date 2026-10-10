import type {Doc} from './model';
export interface GitHubLoad {session:string;repo:string;branch:string;sha:string;doc:Doc}
export interface GitHubSave {doc:Doc;sha:string;commit:{sha:string;url:string}|null;edited:string[]}
export interface BuildRun {name:string;status:string;conclusion:string|null;url:string}
export async function localRequest<T>(action:'load'|'save'|'status',body:unknown):Promise<T>{
  const response=await fetch(`/api/${action}`,{method:'POST',headers:{'Content-Type':'application/json','X-Punchies-Local':'1'},body:JSON.stringify(body)});
  const result=await response.json();
  if(!response.ok)throw Error(result.error??'Local GitHub request failed');
  return result as T;
}
export async function detectLocalMode():Promise<boolean>{
  if(location.hostname!=='127.0.0.1')return false;
  try{const result=await fetch('/local-mode.json');return result.ok&&(await result.json()).github===true;}catch{return false;}
}
