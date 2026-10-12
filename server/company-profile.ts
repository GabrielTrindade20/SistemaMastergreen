import { z } from 'zod';
import { pool } from './db';
import { defaultCompany } from '../shared/company-profile';

const text = z.string().trim().max(250);
export const companyProfileSchema = z.object({
  name:text.min(1),socialName:text.min(1),cnpj:text,address:z.string().trim().max(1000),phone:text,
  email:z.union([z.literal(''),z.string().trim().email().max(250)]),pixKey:text,pixBeneficiary:text,
  responsibleName:text,responsibleRole:text,paymentTerms:z.string().trim().max(1000),validityDays:z.number().int().min(1).max(365),
}).strict();

export async function getCompanyProfile() {
  const result=await pool.query('SELECT value FROM system_settings WHERE key=$1',['company_profile']);
  return result.rows.length?companyProfileSchema.parse(JSON.parse(result.rows[0].value)):{...defaultCompany};
}
export async function saveDocumentSetting(key:'company_profile',value:unknown) {
  await pool.query('INSERT INTO system_settings(key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value',[key,JSON.stringify(value)]);
}
