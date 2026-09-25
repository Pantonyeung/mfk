export const MFK_STAFF_AUTH_SCHEMA='MFK_STAFF_AUTH_V1' as const;
export const MFK_STAFF_PIN_ALGORITHM='PBKDF2-SHA256' as const;
export const MFK_STAFF_PIN_ITERATIONS=120000 as const;

export interface StaffPinVerifier{
  readonly algorithm:typeof MFK_STAFF_PIN_ALGORITHM;
  readonly iterations:number;
  readonly saltHex:string;
  readonly hashHex:string;
}

export interface RuntimeStaffIdentity{
  readonly staffId:string;
  readonly name:string;
  readonly role:'STAFF'|'MANAGER'|'OWNER'|'VIEWER';
  readonly scope:'STORE'|'MULTI_STORE'|'REPORT_ONLY';
  readonly adminLogin:boolean;
  readonly active:boolean;
  readonly permissions:readonly string[];
  readonly pinVerifier?:StaffPinVerifier;
}

export interface RuntimeStaffAuthSnapshot{
  readonly schema:typeof MFK_STAFF_AUTH_SCHEMA;
  readonly staff:readonly RuntimeStaffIdentity[];
}

function bytesToHex(bytes:Uint8Array){
  return [...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');
}
function hexToBytes(value:string){
  if(!/^[0-9a-f]+$/i.test(value)||value.length%2!==0)throw new Error('STAFF_PIN_HEX_INVALID');
  const output=new Uint8Array(value.length/2);
  for(let i=0;i<output.length;i++)output[i]=Number.parseInt(value.slice(i*2,i*2+2),16);
  return output;
}
function cleanPin(pin:string){
  const value=String(pin??'').replace(/\D/g,'');
  if(value.length<4||value.length>8)throw new Error('STAFF_PIN_LENGTH_INVALID');
  return value;
}
function subtle(){
  if(typeof crypto==='undefined'||!crypto.subtle)throw new Error('STAFF_PIN_CRYPTO_UNAVAILABLE');
  return crypto.subtle;
}

export async function createStaffPinVerifier(pin:string):Promise<StaffPinVerifier>{
  const value=cleanPin(pin);
  const salt=new Uint8Array(16);
  crypto.getRandomValues(salt);
  const key=await subtle().importKey('raw',new TextEncoder().encode(value),'PBKDF2',false,['deriveBits']);
  const bits=await subtle().deriveBits({
    name:'PBKDF2',
    hash:'SHA-256',
    salt,
    iterations:MFK_STAFF_PIN_ITERATIONS,
  },key,256);
  return Object.freeze({
    algorithm:MFK_STAFF_PIN_ALGORITHM,
    iterations:MFK_STAFF_PIN_ITERATIONS,
    saltHex:bytesToHex(salt),
    hashHex:bytesToHex(new Uint8Array(bits)),
  });
}

export function verifyConfiguredStaffPin(pin:string,configuredPin:string){
  let left:string,right:string;
  try{left=cleanPin(pin);right=cleanPin(configuredPin);}catch{return false;}
  if(left.length!==right.length)return false;
  let diff=0;
  for(let i=0;i<left.length;i++)diff|=left.charCodeAt(i)^right.charCodeAt(i);
  return diff===0;
}

export async function verifyStaffPin(pin:string,verifier:StaffPinVerifier){
  if(verifier.algorithm!==MFK_STAFF_PIN_ALGORITHM)return false;
  if(!Number.isSafeInteger(verifier.iterations)||verifier.iterations<100000)return false;
  let value:string;
  try{value=cleanPin(pin);}catch{return false;}
  let salt:Uint8Array;
  try{salt=hexToBytes(verifier.saltHex);}catch{return false;}
  const key=await subtle().importKey('raw',new TextEncoder().encode(value),'PBKDF2',false,['deriveBits']);
  const bits=new Uint8Array(await subtle().deriveBits({
    name:'PBKDF2',
    hash:'SHA-256',
    salt,
    iterations:verifier.iterations,
  },key,256));
  const expected=hexToBytes(verifier.hashHex);
  if(bits.length!==expected.length)return false;
  let diff=0;
  for(let i=0;i<bits.length;i++)diff|=bits[i]!^expected[i]!;
  return diff===0;
}

export async function projectStaffForRuntime(input:unknown):Promise<RuntimeStaffAuthSnapshot>{
  const rows=Array.isArray(input)?input:[];
  const staff:RuntimeStaffIdentity[]=[];
  for(const raw of rows){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))continue;
    const row=raw as Record<string,unknown>;
    const staffId=String(row.id??'').trim();
    const name=String(row.name??'').trim();
    if(!staffId||!name)continue;
    const role=['STAFF','MANAGER','OWNER','VIEWER'].includes(String(row.role))?String(row.role) as RuntimeStaffIdentity['role']:'STAFF';
    const scope=['STORE','MULTI_STORE','REPORT_ONLY'].includes(String(row.scope))?String(row.scope) as RuntimeStaffIdentity['scope']:'STORE';
    const permissions=Array.isArray(row.permissions)?row.permissions.map(value=>String(value)).filter(Boolean):[];
    const active=row.active!==false;
    const pin=String(row.pin??'').replace(/\D/g,'');
    let pinVerifier:StaffPinVerifier|undefined;
    if(pin.length>=4&&pin.length<=8)pinVerifier=await createStaffPinVerifier(pin);
    staff.push(Object.freeze({
      staffId,
      name,
      role,
      scope,
      adminLogin:Boolean(row.adminLogin),
      active,
      permissions:Object.freeze([...new Set(permissions)]),
      ...(pinVerifier?{pinVerifier}:{}),
    }));
  }
  return Object.freeze({schema:MFK_STAFF_AUTH_SCHEMA,staff:Object.freeze(staff)});
}

export function validateRuntimeStaffAuthSnapshot(input:unknown):RuntimeStaffAuthSnapshot{
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('STAFF_AUTH_SNAPSHOT_INVALID');
  const row=input as Record<string,unknown>;
  if(row.schema!==MFK_STAFF_AUTH_SCHEMA)throw new Error('STAFF_AUTH_SCHEMA_UNSUPPORTED');
  if(!Array.isArray(row.staff))throw new Error('STAFF_AUTH_ROWS_INVALID');
  const staff=row.staff.map(raw=>{
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('STAFF_AUTH_ROW_INVALID');
    const item=raw as Record<string,unknown>;
    const role=String(item.role) as RuntimeStaffIdentity['role'];
    const scope=String(item.scope) as RuntimeStaffIdentity['scope'];
    if(!['STAFF','MANAGER','OWNER','VIEWER'].includes(role))throw new Error('STAFF_AUTH_ROLE_INVALID');
    if(!['STORE','MULTI_STORE','REPORT_ONLY'].includes(scope))throw new Error('STAFF_AUTH_SCOPE_INVALID');
    const pinVerifier=item.pinVerifier as StaffPinVerifier|undefined;
    if(pinVerifier){
      if(pinVerifier.algorithm!==MFK_STAFF_PIN_ALGORITHM)throw new Error('STAFF_PIN_ALGORITHM_INVALID');
      if(!Number.isSafeInteger(pinVerifier.iterations)||pinVerifier.iterations<100000)throw new Error('STAFF_PIN_ITERATIONS_INVALID');
      hexToBytes(pinVerifier.saltHex);
      hexToBytes(pinVerifier.hashHex);
    }
    return Object.freeze({
      staffId:String(item.staffId??'').trim(),
      name:String(item.name??'').trim(),
      role,
      scope,
      adminLogin:Boolean(item.adminLogin),
      active:item.active!==false,
      permissions:Object.freeze(Array.isArray(item.permissions)?item.permissions.map(value=>String(value)).filter(Boolean):[]),
      ...(pinVerifier?{pinVerifier:Object.freeze({...pinVerifier})}:{}),
    });
  });
  if(staff.some(item=>!item.staffId||!item.name))throw new Error('STAFF_AUTH_IDENTITY_INVALID');
  return Object.freeze({schema:MFK_STAFF_AUTH_SCHEMA,staff:Object.freeze(staff)});
}
