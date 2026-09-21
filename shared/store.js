export const ORDER_STORAGE_KEY='morefun:smt:v19:order';
export const SETTINGS_STORAGE_KEY='morefun:smt:v16c:settings';
export const DRAFT_STORAGE_KEY='morefun:smt:v16:drafts';
export const DRAFT_COUNTER_STORAGE_KEY='morefun:smt:v16:draft-counters';
export const ORDER_HISTORY_STORAGE_KEY='morefun:smt:v16:orders';
export const TERMINAL_ID_STORAGE_KEY='morefun:smt:terminal-id';
export const DINE_STORAGE_KEY='morefun-smt-dine-v2';
export const SUPPLY_STORAGE_KEY='morefun:smt:v1:supply-overrides';
export const OPERATIONS_STORAGE_KEY='morefun:smt:v1:operations';
export const PRINTER_STORAGE_KEY='morefun:smt:v1:printers';
export const BACKUP_STORAGE_KEY='morefun:smt:v1:backups';

export function readJSON(key,fallback){
  try{return JSON.parse(localStorage.getItem(key)||'null')??fallback;}catch{return fallback;}
}
export function writeJSON(key,value){localStorage.setItem(key,JSON.stringify(value));}
export function stableId(prefix='id'){return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;}
