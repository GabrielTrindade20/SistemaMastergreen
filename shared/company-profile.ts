// Keep identical to the mobile company-profile contract (covered by tests).
export type CompanyProfile = {
  name:string; socialName:string; cnpj:string; address:string; phone:string; email:string;
  pixKey:string; pixBeneficiary:string; responsibleName:string; responsibleRole:string;
  paymentTerms:string; validityDays:number;
};
export const defaultCompany:CompanyProfile = {
  name:'MasterGreen', socialName:'ROCHA COMERCIO E INSTALACAO DE GRAMA SINTETICA LTDA',
  cnpj:'36.347.491/0001-99',address:'QNN 24 Conjunto E Lote 14, Ceilândia Sul - DF',
  phone:'(61) 98412-4179',email:'mastergreendf@gmail.com',pixKey:'36.347.491/0001-99',
  pixBeneficiary:'ROCHA COMERCIO E INSTALACAO DE GRAMA SINTETICA LTDA',
  responsibleName:'NEWTON ROCHA',responsibleRole:'Administrador',
  paymentTerms:'50% de entrada + 50% na entrega',validityDays:30,
};
