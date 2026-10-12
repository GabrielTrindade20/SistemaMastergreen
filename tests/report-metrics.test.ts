import {test} from 'node:test';
import assert from 'node:assert/strict';
import {previousPeriod,summarizeReports,type MetricRow} from '../shared/report-metrics';
import {reportRangeSchema} from '../shared/mobile-contract';
const row:MetricRow={businessDate:'2026-10-01',quotationStatus:'approved',quotationTotal:100.11,quotationNetProfit:30,quotationCosts:60,hasRecordedCosts:true,responsibleId:'a',responsibleName:'Teste',commissionPercent:'5'};
test('período anterior tem duração equivalente inclusive em ano bissexto',()=>{assert.deepEqual(previousPeriod('2024-03-01','2024-03-31'),{from:'2024-01-30',to:'2024-02-29'});});
test('métricas usam centavos, aprovadas e cobertura de custos sem inferir lucro',()=>{
  const result=summarizeReports([row,{...row,businessDate:'2026-10-31',hasRecordedCosts:false,quotationTotal:50},{...row,quotationStatus:'pending'},{...row,businessDate:'2026-11-01'}],'2026-10-01','2026-10-31');
  assert.equal(result.approvedCount,2);assert.equal(result.approvedCents,15011);assert.equal(result.financial.covered,1);assert.equal(result.financial.profitCents,3000);assert.equal(result.team[0].commissionCents,751);assert.equal(result.months[0].totalCents,15011);
  assert.equal(summarizeReports([{...row,hasRecordedCosts:false}],'2026-10-01','2026-10-31').financial.profitCents,null);
});
test('datas inválidas e intervalo invertido são recusados',()=>{
  assert.equal(reportRangeSchema.safeParse({from:'2026-02-30',to:'2026-03-01'}).success,false);assert.equal(reportRangeSchema.safeParse({from:'2026-11-01',to:'2026-10-01'}).success,false);
  assert.equal(reportRangeSchema.safeParse({from:'2026-10-01',to:'2026-10-31'}).success,true);
});
