import { mergeSave,parse,type Doc } from './model';
export interface TuneFile {
  name:string;
  getFile():Promise<{text():Promise<string>}>;
  createWritable():Promise<{write(data:string):Promise<void>;close():Promise<void>;abort():Promise<void>}>;
}
export async function saveOpened(file:TuneFile,base:Doc,draft:Doc):Promise<Doc>{
  parse(JSON.stringify(draft));
  // Request permission first, then reread: the user might leave that prompt open.
  const writer=await file.createWritable();
  try {
    const latest=parse(await (await file.getFile()).text());
    const merged=mergeSave(base,draft,latest);
    await writer.write(JSON.stringify(merged,null,2)+'\n');
    await writer.close();
    return merged;
  } catch(error){
    await writer.abort().catch(()=>{});
    throw error;
  }
}
