import {MFK_ADMIN_CONFIG_STORE_ID} from '../../contracts/admin-config-sync-v1.ts';
import type {V3AdminSession} from './auth.ts';

export interface V3AdminScopeContext{
  readonly storeId:string;
  readonly role:string;
  readonly scope:string;
  readonly permissions:readonly string[];
}

export function scopeFromSession(session:V3AdminSession):V3AdminScopeContext{
  return Object.freeze({
    storeId:MFK_ADMIN_CONFIG_STORE_ID,
    role:session.role,
    scope:session.scope,
    permissions:session.permissions,
  });
}
