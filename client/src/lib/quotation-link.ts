export function quotationLinkId(search: string): string | null {
  const id = new URLSearchParams(search).get('view');
  return id && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id) ? id : null;
}

// Only the known, authenticated proposal route can survive login.
export function postLoginPath(pathname: string, search: string): string {
  const id = pathname === '/orcamentos' ? quotationLinkId(search) : null;
  return id ? `/orcamentos?view=${id}${new URLSearchParams(search).get('source')==='app'?'&source=app':''}` : '/dashboard';
}
