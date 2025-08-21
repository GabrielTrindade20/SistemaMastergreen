import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone").notNull(),
  cpfCnpj: text("cpf_cnpj"),
  address: text("address"),
  number: text("number"),
  neighborhood: text("neighborhood"),
  city: text("city").notNull(),
  zipCode: text("zip_code"),
  notes: text("notes"),
  createdById: uuid("created_by_id").references(() => users.id), // ID do vendedor/admin que criou
  createdAt: timestamp("created_at").defaultNow(),
});

export const products = pgTable("products", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").default("Grama"), // Grama, Piso, Carpete, etc
  hasInstallation: integer("has_installation").notNull().default(0), // 0=Não, 1=Sim
  pricePerM2: decimal("price_per_m2", { precision: 10, scale: 2 }).notNull(),
  costPerM2: decimal("cost_per_m2", { precision: 10, scale: 2 }).default("0.00"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const quotations = pgTable("quotations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: uuid("customer_id").references(() => customers.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  quotationNumber: text("quotation_number").notNull().unique(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(), // Total dos produtos
  totalCosts: decimal("total_costs", { precision: 10, scale: 2 }).notNull().default("0.00"), // Total dos custos
  totalWithoutInvoice: decimal("total_without_invoice", { precision: 10, scale: 2 }).notNull().default("0.00"), // Total custos
  invoicePercent: decimal("invoice_percent", { precision: 5, scale: 2 }).notNull().default("5.00"), // 5%
  invoiceAmount: decimal("invoice_amount", { precision: 10, scale: 2 }).notNull().default("0.00"), // 5% sobre venda
  totalWithInvoice: decimal("total_with_invoice", { precision: 10, scale: 2 }).notNull().default("0.00"), // Total com NF
  companyProfit: decimal("company_profit", { precision: 10, scale: 2 }).notNull().default("0.00"), // Lucro empresa
  profitPercent: decimal("profit_percent", { precision: 10, scale: 2 }).notNull().default("0.00"), // % lucro
  tithe: decimal("tithe", { precision: 10, scale: 2 }).notNull().default("0.00"), // Dízimo (10%)
  netProfit: decimal("net_profit", { precision: 10, scale: 2 }).notNull().default("0.00"), // Lucro líquido
  total: decimal("total", { precision: 10, scale: 2 }).notNull(), // Total final ao cliente
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  validUntil: timestamp("valid_until").notNull(),
  notes: text("notes"),
  shippingIncluded: integer("shipping_included").default(1), // 1 = yes, 0 = no
  warrantyText: text("warranty_text").default("1 ano de garantia de fábrica"),
  pdfTitle: text("pdf_title"),
  responsibleName: text("responsible_name"),
  responsiblePosition: text("responsible_position").default("Administrador"),
  responsibleId: uuid("responsible_id").references(() => users.id), // vendedor responsável
  adminCalculated: integer("admin_calculated").default(0), // 0=original, 1=calculado pelo admin
  originalQuotationId: text("original_quotation_id"), // Referência à proposta original quando é versão calculada
  branch: text("branch").notNull(), // filial do orçamento
  createdAt: timestamp("created_at").defaultNow(),
});

export const quotationItems = pgTable("quotation_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  quotationId: uuid("quotation_id").references(() => quotations.id).notNull(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(), // area in m²
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).notNull(),
});

export const costs = pgTable("costs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  supplier: text("supplier").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const quotationCosts = pgTable("quotation_costs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  quotationId: uuid("quotation_id").references(() => quotations.id).notNull(),
  costId: uuid("cost_id").references(() => costs.id),
  name: text("name").notNull(), // For variable costs or copy of cost name
  unitValue: decimal("unit_value", { precision: 10, scale: 2 }).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default("1.00"),
  totalValue: decimal("total_value", { precision: 10, scale: 2 }).notNull(),
  supplier: text("supplier"),
  description: text("description"),
  calculationType: text("calculation_type").default("fixed"), // 'fixed' or 'percentage'
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  type: text("type").notNull(), // "admin" or "vendedor"
  branch: text("branch").notNull(), // filial
  commissionPercent: text("commission_percent").default("0"), // percentual de comissão do vendedor
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const customersRelations = relations(customers, ({ many }) => ({
  quotations: many(quotations),
}));

export const productsRelations = relations(products, ({ many }) => ({
  quotationItems: many(quotationItems),
}));

export const quotationsRelations = relations(quotations, ({ one, many }) => ({
  customer: one(customers, {
    fields: [quotations.customerId],
    references: [customers.id],
  }),
  user: one(users, {
    fields: [quotations.userId],
    references: [users.id],
  }),
  items: many(quotationItems),
  costs: many(quotationCosts),
}));

export const usersRelations = relations(users, ({ many }) => ({
  quotations: many(quotations),
}));

export const quotationItemsRelations = relations(quotationItems, ({ one }) => ({
  quotation: one(quotations, {
    fields: [quotationItems.quotationId],
    references: [quotations.id],
  }),
  product: one(products, {
    fields: [quotationItems.productId],
    references: [products.id],
  }),
}));

export const costsRelations = relations(costs, ({ many }) => ({
  quotationCosts: many(quotationCosts),
}));

export const quotationCostsRelations = relations(quotationCosts, ({ one }) => ({
  quotation: one(quotations, {
    fields: [quotationCosts.quotationId],
    references: [quotations.id],
  }),
  cost: one(costs, {
    fields: [quotationCosts.costId],
    references: [costs.id],
  }),
}));

// Insert schemas
export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});

export const insertQuotationSchema = createInsertSchema(quotations).omit({
  id: true,
  createdAt: true,
  quotationNumber: true,
});

export const insertQuotationItemSchema = createInsertSchema(quotationItems).omit({
  id: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertCostSchema = createInsertSchema(costs).omit({
  id: true,
  createdAt: true,
});

export const insertQuotationCostSchema = createInsertSchema(quotationCosts).omit({
  id: true,
});

export const loginUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Types
export type Customer = typeof customers.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Quotation = typeof quotations.$inferSelect;
export type QuotationItem = typeof quotationItems.$inferSelect;
export type User = typeof users.$inferSelect;
export type Cost = typeof costs.$inferSelect;
export type QuotationCost = typeof quotationCosts.$inferSelect;

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertQuotation = z.infer<typeof insertQuotationSchema>;
export type InsertQuotationItem = z.infer<typeof insertQuotationItemSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertCost = z.infer<typeof insertCostSchema>;
export type InsertQuotationCost = z.infer<typeof insertQuotationCostSchema>;
export type LoginUser = z.infer<typeof loginUserSchema>;

// Extended types for API responses
export type QuotationWithDetails = Quotation & {
  customer: Customer;
  user: User;
  items: (QuotationItem & { product: Product })[];
  costs: (QuotationCost & { cost?: Cost })[];
};
