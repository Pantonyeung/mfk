import {Navigate,Route,Routes} from 'react-router';
import {AdminShell} from './AdminShell.tsx';
import {ADMIN_CAPABILITIES} from './admin-capabilities.ts';
import {AdminDraftProvider} from './admin-draft.tsx';
import {CategoriesWorkspace,CombosWorkspace,MenuDisplayWorkspace,ModifiersWorkspace,PricingWorkspace,ProductsWorkspace} from './CatalogWorkspaces.tsx';
import {AvailabilityWorkspace,BusinessDayWorkspace,ChannelsWorkspace,PrintCenterWorkspace,PrintTemplatesWorkspace,StaffWorkspace,StoreSettingsWorkspace} from './PolicyWorkspaces.tsx';
import {AuditWorkspace,CapacityWorkspace,ExceptionsWorkspace,OpenOrdersWorkspace,OperationsReportWorkspace,OrdersHistoryWorkspace,OverviewWorkspace,SalesReportWorkspace} from './ReadModelWorkspaces.tsx';
import {PrintRulesWorkspace,PublishCenterWorkspace,QuickReasonsWorkspace,SettlementWorkspace} from './GovernanceWorkspaces.tsx';
import {AnnouncementsWorkspace,CouponsWorkspace,Customer360Workspace,InventoryWorkspace,LoyaltyWorkspace,PresentationWorkspace,RfmWorkspace,StoreBindingWorkspace} from './DeferredWorkspaces.tsx';
import {ActionQueueWorkspace,AccessSessionWorkspace,CashCloseRecordWorkspace,ChannelReportWorkspace,DeviceHealthWorkspace,DiagnosticsWorkspace,EffectiveSettingsWorkspace,ExportGovernanceWorkspace,IntegrationsGovernanceWorkspace,OtaWorkspace,ProductReportWorkspace,RefundReportWorkspace} from './WorkflowUpgradeWorkspaces.tsx';

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
