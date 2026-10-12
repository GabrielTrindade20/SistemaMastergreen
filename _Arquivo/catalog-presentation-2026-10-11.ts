// Archived: separate app classifications were retired in favor of products.category from the web.
export type CatalogKind = 'product'|'service'|'material';
export type CatalogUnit = 'm²'|'un'|'m'|'serviço';
export type CatalogPresentation = {kind:CatalogKind; category:string; unit:CatalogUnit};
export type CatalogOverrides = Record<string,CatalogPresentation>;
export const catalogLabels:Record<CatalogKind,string>={product:'Produtos',service:'Serviços',material:'Materiais'};
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
// Display suggestions only: never updates legacy categories or financial records.
export function classifyCatalog(product:{name:string;category?:string|null},override?:CatalogPresentation):CatalogPresentation {
  if(override)return override;
  const name=normalize(product.name);
  if(/^(frete|entrega)/.test(name))return {kind:'service',category:'Frete e entrega',unit:'serviço'};
  if(/^(mao.?de.?obra|instalacao|aplicacao|construcao|descarte|regularizacao|retirada|remocao|cacamba)/.test(name))return {kind:'service',category:'Instalação e preparação',unit:'m²'};
  if(/^(lata|galao|cola|grampo|tape|calcario|po de brita|cantoneira)/.test(name))return {kind:'material',category:'Insumos e acabamentos',unit:/^(lata|galao|grampo|tape)/.test(name)?'un':'m²'};
  if(/^(grama|campo sintetico|venda e instalacao de grama|pista de hyrox)/.test(name))return {kind:'product',category:'Gramas',unit:'m²'};
  if(/^(carpete|carpacho|capacho|tapete)/.test(name))return {kind:'product',category:'Carpetes e capachos',unit:'m²'};
  if(/^(piso|rodape)/.test(name))return {kind:'product',category:'Pisos e rodapés',unit:name.startsWith('rodape')?'m':'m²'};
  if(/^(par de trave|rede)/.test(name))return {kind:'product',category:'Acessórios esportivos',unit:'un'};
  return {kind:'product',category:product.category?.trim()||'Outros',unit:'m²'};
}
