type DateValue = string | Date | null | undefined;
const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function proposalDate(value: DateValue): string {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = dateFormatter.formatToParts(date);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function currentProposalPeriod(now = new Date()) {
  const date = proposalDate(now);
  return { year: date.slice(0, 4), month: String(Number(date.slice(5, 7))) };
}

export function matchesProposalPeriod(value: DateValue, year: string, month: string) {
  return proposalDate(value).startsWith(`${year}-${month.padStart(2, '0')}-`);
}

export function newestProposals<W extends {id:string;createdAt:DateValue}, M extends {id:string;date:string}>(web: W[], mobile: M[]) {
  const rows: ({source:'web';value:W}|{source:'mobile';value:M})[] = [
    ...web.map(value => ({source:'web' as const,value})),
    ...mobile.map(value => ({source:'mobile' as const,value})),
  ];
  const date = (row:typeof rows[number]) => row.source==='web'?row.value.createdAt:row.value.date;
  const time = (row:typeof rows[number]) => {
    const value = date(row);
    return value ? new Date(value).getTime() || 0 : 0;
  };
  return rows.sort((a,b) => proposalDate(date(b)).localeCompare(proposalDate(date(a))) || time(b)-time(a) || a.value.id.localeCompare(b.value.id));
}
