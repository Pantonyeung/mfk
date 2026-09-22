import {Navigate,Route,Routes,useLocation} from 'react-router';
import {AdminShell} from './AdminShell.tsx';
import {ADMIN_CAPABILITIES,findAdminCapability} from './admin-capabilities.ts';
import {MFK_ADMIN_AUTHORITY} from './admin-authority.ts';
import {AdminDraftProvider} from './admin-draft.tsx';
import {CategoriesWorkspace,CombosWorkspace,MenuDisplayWorkspace,ModifiersWorkspace,PricingWorkspace,ProductsWorkspace} from './CatalogWorkspaces.tsx';
import {AvailabilityWorkspace,BusinessDayWorkspace,ChannelsWorkspace,PrintCenterWorkspace,PrintTemplatesWorkspace,StaffWorkspace,StoreSettingsWorkspace} from './PolicyWorkspaces.tsx';
import {AuditWorkspace,CapacityWorkspace,ExceptionsWorkspace,OpenOrdersWorkspace,OperationsReportWorkspace,OrdersHistoryWorkspace,OverviewWorkspace,SalesReportWorkspace} from './ReadModelWorkspaces.tsx';
import {PrintRulesWorkspace,PublishCenterWorkspace,QuickReasonsWorkspace,SettlementWorkspace} from './GovernanceWorkspaces.tsx';
import {AnnouncementsWorkspace,CouponsWorkspace,Customer360Workspace,InventoryWorkspace,LoyaltyWorkspace,PresentationWorkspace,RfmWorkspace,StoreBindingWorkspace} from './DeferredWorkspaces.tsx';
import {ActionQueueWorkspace,AccessSessionWorkspace,CashCloseRecordWorkspace,ChannelReportWorkspace,DeviceHealthWorkspace,DiagnosticsWorkspace,EffectiveSettingsWorkspace,ExportGovernanceWorkspace,IntegrationsGovernanceWorkspace,OtaWorkspace,ProductReportWorkspace,RefundReportWorkspace} from './WorkflowUpgradeWorkspaces.tsx';

const statusTitle={
  NOT_WIRED:'尚未啟用',
  DEFERRED:'能力保留，暫不啟用',
  RETIRED:'能力已退役',
} as const;

function CapabilityPage(){
  const location=useLocation();
  const capability=findAdminCapability(location.pathname);
  if(!capability)return <Navigate to="/admin/overview" replace/>;

  return <section className="mfk-admin-capability">
    <header>
      <div><small>管理後台</small><h1>{capability.label}</h1><p>{capability.purpose}</p></div>
      <span className={'status '+capability.status.toLowerCase()}>{statusTitle[capability.status]}</span>
    </header>

    <div className="mfk-admin-facts">
      <article><span>功能位置</span><b>{capability.path}</b></article>
      <article><span>負責範圍</span><b>{capability.owner}</b></article>
      <article><span>連接狀態</span><b>{capability.status}</b></article>
      <article><span>即時變更</span><b>{MFK_ADMIN_AUTHORITY.liveMutationEnabled?'ON':'OFF'}</b></article>
    </div>

    <section className="mfk-admin-rule-card">
      <h2>主權流程</h2>
      <div className="authority-flow">
        <span>規則決定</span><i>→</i><span>編輯草稿</span><i>→</i><span>檢查內容</span><i>→</i><span>發布</span><i>→</i><span>已生效版本</span><i>→</i><span>門店使用</span>
      </div>
      <p>呢個頁面只顯示目前可以操作嘅設定。未啟用嘅功能會清楚標示，唔會誤導為已生效。</p>
    </section>

    <section className="mfk-admin-state-card">
      <header><h2>目前狀態</h2><span>{capability.status}</span></header>
      <p>呢項功能已經有固定位置同負責範圍；未啟用之前，只會提供清楚嘅操作提示。</p>
    </section>
  </section>;
}

function capabilityElement(id:string){
  if(id==='products')return <ProductsWorkspace/>;
  if(id==='categories')return <CategoriesWorkspace/>;
  if(id==='modifiers')return <ModifiersWorkspace/>;
  if(id==='pricing')return <PricingWorkspace/>;
  if(id==='combo')return <CombosWorkspace/>;
  if(id==='menu-sort')return <MenuDisplayWorkspace/>;
  if(id==='customer-presentation')return <PresentationWorkspace surface="CUSTOMER"/>;
  if(id==='owner-presentation')return <PresentationWorkspace surface="OWNER"/>;
  if(id==='frontline-presentation')return <PresentationWorkspace surface="FRONTLINE"/>;
  if(id==='overview')return <OverviewWorkspace/>;
  if(id==='action-queue')return <ActionQueueWorkspace/>;
  if(id==='publish-center')return <PublishCenterWorkspace/>;
  if(id==='open-orders')return <OpenOrdersWorkspace/>;
  if(id==='availability')return <AvailabilityWorkspace/>;
  if(id==='capacity')return <CapacityWorkspace/>;
  if(id==='inventory')return <InventoryWorkspace/>;
  if(id==='business-day')return <BusinessDayWorkspace/>;
  if(id==='cash-close')return <CashCloseRecordWorkspace/>;
  if(id==='orders-history')return <OrdersHistoryWorkspace/>;
  if(id==='exceptions')return <ExceptionsWorkspace/>;
  if(id==='print-center')return <PrintCenterWorkspace/>;
  if(id==='print-templates')return <PrintTemplatesWorkspace/>;
  if(id==='print-rules')return <PrintRulesWorkspace/>;
  if(id==='device-health')return <DeviceHealthWorkspace/>;
  if(id==='ota')return <OtaWorkspace/>;
  if(id==='store-settings')return <StoreSettingsWorkspace/>;
  if(id==='quick-reasons')return <QuickReasonsWorkspace/>;
  if(id==='announcement')return <AnnouncementsWorkspace/>;
  if(id==='staff')return <StaffWorkspace/>;
  if(id==='access-session')return <AccessSessionWorkspace/>;
  if(id==='sales-report')return <SalesReportWorkspace/>;
  if(id==='product-report')return <ProductReportWorkspace/>;
  if(id==='channel-report')return <ChannelReportWorkspace/>;
  if(id==='refund-report')return <RefundReportWorkspace/>;
  if(id==='operations-report')return <OperationsReportWorkspace/>;
  if(id==='export-governance')return <ExportGovernanceWorkspace/>;
  if(id==='rfm-report')return <RfmWorkspace/>;
  if(id==='audit')return <AuditWorkspace/>;
  if(id==='diagnostics')return <DiagnosticsWorkspace/>;
  if(id==='integrations-governance')return <IntegrationsGovernanceWorkspace/>;
  if(id==='advanced')return <EffectiveSettingsWorkspace/>;
  if(id==='channel-overview')return <ChannelsWorkspace mode="overview"/>;
  if(id==='product-mapping')return <ChannelsWorkspace mode="mapping"/>;
  if(id==='mapping-failure')return <ChannelsWorkspace mode="failures"/>;
  if(id==='accept-policy')return <ChannelsWorkspace mode="accept"/>;
  if(id==='sync-policy')return <ChannelsWorkspace mode="sync"/>;
  if(id==='net-estimate')return <ChannelsWorkspace mode="estimate"/>;
  if(id==='store-binding')return <StoreBindingWorkspace/>;
  if(id==='settlement')return <SettlementWorkspace/>;
  if(id==='members')return <Customer360Workspace/>;
  if(id==='loyalty')return <LoyaltyWorkspace/>;
  if(id==='coupons')return <CouponsWorkspace/>;
  return <CapabilityPage/>;
}

export function MfkAdminApp(){
  return <AdminDraftProvider><AdminShell><Routes>
    {ADMIN_CAPABILITIES.map(item=><Route key={item.id} path={item.path} element={capabilityElement(item.id)}/>)}
    <Route path="/" element={<Navigate to="/admin/overview" replace/>}/>
    <Route path="*" element={<Navigate to="/admin/overview" replace/>}/>
  </Routes></AdminShell></AdminDraftProvider>;
}
