export type MetricRow = {businessDate:string;quotationStatus:string;quotationTotal:number;quotationNetProfit:number;quotationCosts:number;hasRecordedCosts:boolean;responsibleId?:string;responsibleName?:string;commissionPercent?:string};
export const cents=(value:number)=>Math.round(value*100);
export function previousPeriod(from:string,to:string) {
  const start=Date.parse(from+'T12:00:00Z'),end=Date.parse(to+'T12:00:00Z'),day=86_400_000;
  return {from:new Date(start-(end-start+day)).toISOString().slice(0,10),to:new Date(start-day).toISOString().slice(0,10)};
}
export function summarizeReports(rows:MetricRow[],from:string,to:string) {
  const approved=rows.filter(row=>row.quotationStatus==='approved'&&row.businessDate>=from&&row.businessDate<=to);
  const totalCents=approved.reduce((sum,row)=>sum+cents(row.quotationTotal),0);
  const recorded=approved.filter(row=>row.hasRecordedCosts);
  const teams=new Map<string,{id:string;name:string;count:number;totalCents:number;commissionCents:number|null}>();
  const months=new Map<string,number>();
  for(let year=+from.slice(0,4),month=+from.slice(5,7);`${year}-${String(month).padStart(2,'0')}`<=to.slice(0,7);){months.set(`${year}-${String(month).padStart(2,'0')}`,0);if(++month===13){month=1;year++;}}
  for(const row of approved){
    const id=row.responsibleId||'unknown',amount=cents(row.quotationTotal);
    const team=teams.get(id)||{id,name:row.responsibleName||'Não informado',count:0,totalCents:0,commissionCents:0};
    team.count++;team.totalCents+=amount;
    const rate=Number((row.commissionPercent||'').replace(',','.'));
    team.commissionCents=row.commissionPercent!=null&&Number.isFinite(rate)&&rate>=0&&rate<=100&&team.commissionCents!==null?team.commissionCents+Math.round(amount*rate/100):null;
    teams.set(id,team);months.set(row.businessDate.slice(0,7),(months.get(row.businessDate.slice(0,7))||0)+amount);
  }
  return {approvedCount:approved.length,approvedCents:totalCents,averageCents:approved.length?Math.round(totalCents/approved.length):0,
    financial:{covered:recorded.length,total:approved.length,costsCents:recorded.length?recorded.reduce((sum,row)=>sum+cents(row.quotationCosts),0):null,profitCents:recorded.length?recorded.reduce((sum,row)=>sum+cents(row.quotationNetProfit),0):null},
    months:Array.from(months).map(([month,totalCents])=>({month,totalCents})),team:Array.from(teams.values()).sort((a,b)=>b.totalCents-a.totalCents)};
}
