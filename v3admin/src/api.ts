export interface V3Health{
  ok:boolean;
  service:string;
  sourceSha:string;
}

export const v3QueryKeys=Object.freeze({
  health:['mfk','admin-v3','health'] as const,
});

export async function readV3BackendHealth():Promise<V3Health>{
  const base=(import.meta.env.VITE_MFK_ADMIN_API_BASE as string|undefined)?.replace(/\/$/,'')??'';
  const response=await fetch(base+'/api/health',{cache:'no-store',credentials:'include'});
  if(!response.ok)throw new Error('V3_ADMIN_HEALTH_HTTP_'+response.status);
  const body=await response.json() as Partial<V3Health>;
  if(body.ok!==true||typeof body.service!=='string'||typeof body.sourceSha!=='string'){
    throw new Error('V3_ADMIN_HEALTH_INVALID');
  }
  return {ok:true,service:body.service,sourceSha:body.sourceSha};
}
