import { summarizeReports, type MetricRow } from './report-metrics';

type Person = { id:string; name:string; branch:string; type:string; commissionPercent?:string|null };
export function adminDashboard(rows:MetricRow[], people:Person[], owner:Person, customerCount:number, from:string, to:string) {
  const period=rows.filter(row=>row.businessDate>=from&&row.businessDate<=to);
  const metrics=summarizeReports(period,from,to);
  const performance=(person:Person)=>{
    const own=period.filter(row=>row.responsibleId===person.id);
    const summary=summarizeReports(own,from,to);
    return {totalSales:summary.approvedCents/100,totalProfit:(summary.financial.profitCents??0)/100,
      quotationsCount:summary.approvedCount,allQuotationsCount:own.length,
      conversionRate:own.length?summary.approvedCount/own.length*100:0};
  };
  const employees=people.filter(person=>['vendedor','funcionario','employee'].includes(person.type));
  const commissionsByEmployee=employees.map(person=>({employeeId:person.id,employeeName:person.name,employeeBranch:person.branch,
    commissionPercent:Number((person.commissionPercent||'0').replace(',','.')),
    ...performance(person),totalCommission:(metrics.team.find(team=>team.id===person.id)?.commissionCents??0)/100}));
  return {type:'admin',totalRevenue:metrics.approvedCents/100,totalCosts:(metrics.financial.costsCents??0)/100,
    totalNetProfit:(metrics.financial.profitCents??0)/100,financialCoverage:metrics.financial,
    pendingQuotations:period.filter(row=>row.quotationStatus==='pending').length,activeCustomers:customerCount,
    conversionRate:period.length?metrics.approvedCount/period.length*100:0,approvedQuotations:metrics.approvedCount,totalQuotations:period.length,
    commissionsByEmployee,totalCommissionsPaid:commissionsByEmployee.reduce((sum,row)=>sum+row.totalCommission,0),
    employeesCount:employees.length,processedQuotations:metrics.financial.covered,pendingProcessing:metrics.approvedCount-metrics.financial.covered,
    adminPerformance:{employeeId:owner.id,employeeName:owner.name,employeeBranch:owner.branch,...performance(owner)},
    otherAdminsPerformance:people.filter(person=>person.type==='admin'&&person.id!==owner.id).map(person=>({adminId:person.id,adminName:person.name,adminBranch:person.branch,...performance(person)}))};
}
