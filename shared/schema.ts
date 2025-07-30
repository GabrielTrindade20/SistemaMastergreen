import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  cpfCnpj: text("cpf_cnpj").notNull(),
  address: text("address"),
  number: text("number"),
  neighborhood: text("neighborhood"),
  city: text("city"),
  zipCode: text("zip_code"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const products = pgTable("products", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  pricePerM2: decimal("price_per_m2", { precision: 10, scale: 2 }).notNull(),
  category: text("category"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const quotations = pgTable("quotations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: uuid("customer_id").references(() => customers.id).notNull(),
  quotationNumber: text("quotation_number").notNull().unique(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  validUntil: timestamp("valid_until").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const quotationItems = pgTable("quotation_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  quotationId: uuid("quotation_id").references(() => quotations.id).notNull(),
  productId: uuid("product_id").references(() => products.id).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(), // area in m²
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
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
  items: many(quotationItems),
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

// Types
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type Quotation = typeof quotations.$inferSelect;
export type InsertQuotation = z.infer<typeof insertQuotationSchema>;

export type QuotationItem = typeof quotationItems.$inferSelect;
export type InsertQuotationItem = z.infer<typeof insertQuotationItemSchema>;

// Extended types for API responses
export type QuotationWithDetails = Quotation & {
  customer: Customer;
  items: (QuotationItem & { product: Product })[];
};
