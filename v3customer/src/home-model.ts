export type QuickCardId='featured'|'popular'|'offer'|'pickup';
export type StoreStatus='open'|'closed';

export type CustomerLongHomeVM=Readonly<{
  storeStatus:StoreStatus;
  storeStatusLabel:string;
  searchPlaceholder:string;
  quickCards:readonly Readonly<{id:QuickCardId;title:string;subtitle:string;tone:string}>[];
  recentOrder:Readonly<{itemSummary:string;orderedAtLabel:string}>|null;
}>;

/**
 * Presentation-only view model.
 * Production adapters must supply canonical read-model facts.
 */
