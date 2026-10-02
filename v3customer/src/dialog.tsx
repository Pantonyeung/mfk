import {useEffect,useRef,type ReactNode} from 'react';

export function AppDialog({labelledBy,onClose,children,className=''}:Readonly<{
  labelledBy:string;
  onClose:()=>void;
  children:ReactNode;
  className?:string;
}>){
  const ref=useRef<HTMLDialogElement>(null);

  useEffect(()=>{
    const dialog=ref.current;
    if(!dialog)return;
    dialog.showModal();
    return ()=>dialog.close();
  },[]);

  return <dialog
    ref={ref}
    className={`app-dialog ${className}`.trim()}
    aria-labelledby={labelledBy}
    onCancel={event=>{event.preventDefault();onClose();}}
    onClick={event=>{if(event.target===event.currentTarget)onClose();}}
  >
    <div>{children}</div>
  </dialog>;
}
