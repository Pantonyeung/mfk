export type CustomerLongHomeVM=Readonly<{
  locationLabel:string;
  searchPlaceholder:string;
  quickCards:readonly Readonly<{id:string;title:string;subtitle:string;icon:string;tone:string}>[];
  categories:readonly Readonly<{id:string;title:string;subtitle:string;icon:string;tone:string}>[];
  products:readonly Readonly<{id:string;name:string;description:string;price:string;imageUrl:string}>[];
  pointsLabel:string;
  inviteRewardLabel:string;
  recentOrder:Readonly<{itemSummary:string;orderedAtLabel:string}>|null;
}>;

/**
 * Presentation-only view model.
 * Production adapters must supply canonical read-model facts.
 */
