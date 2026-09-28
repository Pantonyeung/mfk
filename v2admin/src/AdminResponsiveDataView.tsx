import type {ReactNode} from 'react';
import {AdminEmptyState} from './AdminStateSurfaces.tsx';

export interface AdminDataColumn<Row>{
  readonly key:string;
  readonly label:string;
  readonly render:(row:Row)=>ReactNode;
  readonly numeric?:boolean;
}

export function AdminResponsiveDataView<Row>({
  label,rows,columns,rowKey,emptyTitle='未有資料',emptyDescription,
}:{
  label:string;
  rows:readonly Row[];
  columns:readonly AdminDataColumn<Row>[];
  rowKey:(row:Row)=>string;
  emptyTitle?:string;
  emptyDescription:string;
}){
  if(rows.length===0)return <AdminEmptyState title={emptyTitle} description={emptyDescription}/>;
  return <div className="admin-responsive-data-view">
    <table>
      <caption className="admin-visually-hidden">{label}</caption>
      <thead><tr>{columns.map(column=><th key={column.key} scope="col" className={column.numeric?'is-numeric':undefined}>{column.label}</th>)}</tr></thead>
      <tbody>{rows.map(row=><tr key={rowKey(row)}>{columns.map(column=><td key={column.key} data-label={column.label} className={column.numeric?'is-numeric':undefined}>{column.render(row)}</td>)}</tr>)}</tbody>
    </table>
  </div>;
}
