import {test} from 'node:test';
import assert from 'node:assert/strict';
import {adminDashboard} from '../shared/dashboard-metrics';
const admin={id:'owner',name:'Owner',type:'admin',branch:'Matriz'};
test('dashboard matches canonical metrics, preserves zero/loss and excludes unknown profit',()=>{
  const row={businessDate:'2026-10-12',quotationStatus:'approved',quotationTotal:100,quotationCosts:50,quotationNetProfit:0,hasRecordedCosts:true,responsibleId:'owner'};
  const result=adminDashboard([row,{...row,quotationNetProfit:-20},{...row,quotationCosts:0,quotationNetProfit:100,hasRecordedCosts:false},{...row,quotationStatus:'pending'},{...row,businessDate:'2026-09-30'}],[admin],admin,3,'2026-10-01','2026-10-31');
  assert.equal(result.totalRevenue,300);assert.equal(result.totalCosts,100);assert.equal(result.totalNetProfit,-20);
  assert.equal(result.totalQuotations,4);assert.equal(result.approvedQuotations,3);assert.equal(result.pendingQuotations,1);
  assert.equal(result.adminPerformance.totalProfit,-20);assert.equal(result.financialCoverage.covered,2);
});
