import { PRO_PRICE } from "../../shared/pricing.js";
export function matchesPlannedPrice(price: {active?:boolean;currency?:string;unit_amount?:number|null;type?:string;billing_scheme?:string;recurring?:{interval?:string;interval_count?:number;usage_type?:string}|null}, plan:"monthly"|"yearly"):boolean {
 return price.active===true && price.currency==="usd" && price.type==="recurring" && price.billing_scheme==="per_unit" && price.unit_amount===(plan==="monthly"?PRO_PRICE.monthlyCents:PRO_PRICE.yearlyCents) && price.recurring?.interval===(plan==="monthly"?"month":"year") && price.recurring.interval_count===1 && price.recurring.usage_type==="licensed";
}
