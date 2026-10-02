export interface StoreKernelReadback{
  readonly commitId:string;
  readonly state:'COMMITTED'|'REJECTED'|'UNKNOWN';
}

export interface StoreKernelPort{
  readHealth():Promise<{ok:boolean;sourceSha?:string}>;
  submitFormalCommand(input:{
    submissionId:string;
    idempotencyKey:string;
    type:string;
    payload:unknown;
  }):Promise<StoreKernelReadback>;
  readSubmission(submissionId:string):Promise<StoreKernelReadback>;
}

export const STORE_KERNEL_AUTHORITY='FORMAL_TRANSACTION_AUTHORITY' as const;
