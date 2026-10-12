import {test} from 'node:test';
import assert from 'node:assert/strict';
import {currentProposalPeriod,matchesProposalPeriod,newestProposals,proposalDate} from '../client/src/lib/quotation-list';

test('período inicial usa mês/ano atuais no fuso de Brasília, inclusive na virada',()=>{
  assert.deepEqual(currentProposalPeriod(new Date('2026-10-12T15:00:00Z')),{year:'2026',month:'10'});
  assert.deepEqual(currentProposalPeriod(new Date('2027-01-01T01:00:00Z')),{year:'2026',month:'12'});
  assert.deepEqual(currentProposalPeriod(new Date('2027-01-01T03:00:00Z')),{year:'2027',month:'1'});
});
test('mês e ano obrigatórios isolam períodos e respeitam data simples do app',()=>{
  assert.equal(matchesProposalPeriod('2026-10-01','2026','10'),true);
  assert.equal(matchesProposalPeriod('2026-09-30','2026','10'),false);
  assert.equal(matchesProposalPeriod('2025-10-20','2026','10'),false);
  assert.equal(matchesProposalPeriod('2026-11-01T01:00:00Z','2026','10'),true);
  assert.equal(matchesProposalPeriod('2026-11-01T03:00:00Z','2026','10'),false);
  for(const invalid of [null,undefined,'invalid'])assert.equal(matchesProposalPeriod(invalid,'2026','10'),false);
  assert.equal(proposalDate('2026-10-01'),'2026-10-01');
});
test('ordena web e app juntos por data decrescente, sem alterar os arrays recebidos',()=>{
  const web=[{id:'old',createdAt:'2026-10-01T15:00:00Z'},{id:'new',createdAt:'2026-10-15T15:00:00Z'}];
  const mobile=[{id:'app-new',date:'2026-10-17'},{id:'app-middle',date:'2026-10-10'}];
  const before=structuredClone({web,mobile});
  assert.deepEqual(newestProposals(web,mobile).map(row=>row.value.id),['app-new','new','app-middle','old']);
  assert.deepEqual({web,mobile},before);
});
test('desempate por horário e id é estável e datas ausentes ficam no final',()=>{
  const web=[{id:'b',createdAt:'2026-10-12T10:00:00Z'},{id:'last',createdAt:null},{id:'a',createdAt:'2026-10-12T10:00:00Z'},{id:'late',createdAt:'2026-10-12T21:00:00Z'}];
  assert.deepEqual(newestProposals(web,[]).map(row=>row.value.id),['late','a','b','last']);
  assert.deepEqual(newestProposals([],[]),[]);
});
