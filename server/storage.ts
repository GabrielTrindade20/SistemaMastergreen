import { 
  customers, 
  products, 
  quotations, 
  quotationItems,
  type Customer, 
  type InsertCustomer,
  type Product,
  type InsertProduct,
  type Quotation,
  type InsertQuotation,
  type QuotationItem,
  type InsertQuotationItem,
  type QuotationWithDetails
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";

export interface IStorage {
  // Customers
  getCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, customer: Partial<InsertCustomer>): Promise<Customer>;
  deleteCustomer(id: string): Promise<void>;

  // Products
  getProducts(): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  initializeDefaultProducts(): Promise<void>;

  // Quotations
  getQuotations(): Promise<QuotationWithDetails[]>;
  getQuotation(id: string): Promise<QuotationWithDetails | undefined>;
  createQuotation(quotation: InsertQuotation, items: InsertQuotationItem[]): Promise<QuotationWithDetails>;
  updateQuotationStatus(id: string, status: string): Promise<Quotation>;
  deleteQuotation(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Customers
  async getCustomers(): Promise<Customer[]> {
    return await db.select().from(customers).orderBy(desc(customers.createdAt));
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const [newCustomer] = await db.insert(customers).values(customer).returning();
    return newCustomer;
  }

  async updateCustomer(id: string, customer: Partial<InsertCustomer>): Promise<Customer> {
    const [updatedCustomer] = await db
      .update(customers)
      .set(customer)
      .where(eq(customers.id, id))
      .returning();
    return updatedCustomer;
  }

  async deleteCustomer(id: string): Promise<void> {
    await db.delete(customers).where(eq(customers.id, id));
  }

  // Products
  async getProducts(): Promise<Product[]> {
    return await db.select().from(products).orderBy(products.name);
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async initializeDefaultProducts(): Promise<void> {
    const existingProducts = await this.getProducts();
    if (existingProducts.length === 0) {
      const defaultProducts = [
        {
          name: "Grama Sintética",
          pricePerM2: "64.00",
          category: "Decoração",
          description: "Grama sintética de alta qualidade para jardins e áreas externas"
        },
        {
          name: "Capacho Vinil",
          pricePerM2: "55.00",
          category: "Proteção",
          description: "Capacho de vinil resistente para entrada de estabelecimentos"
        },
        {
          name: "Piso Tátil",
          pricePerM2: "52.00",
          category: "Acessibilidade",
          description: "Piso tátil para acessibilidade de pessoas com deficiência visual"
        }
      ];

      for (const product of defaultProducts) {
        await this.createProduct(product);
      }
    }
  }

  // Quotations
  async getQuotations(): Promise<QuotationWithDetails[]> {
    const result = await db
      .select()
      .from(quotations)
      .leftJoin(customers, eq(quotations.customerId, customers.id))
      .orderBy(desc(quotations.createdAt));

    const quotationsWithDetails: QuotationWithDetails[] = [];

    for (const row of result) {
      if (row.quotations && row.customers) {
        const items = await db
          .select()
          .from(quotationItems)
          .leftJoin(products, eq(quotationItems.productId, products.id))
          .where(eq(quotationItems.quotationId, row.quotations.id));

        quotationsWithDetails.push({
          ...row.quotations,
          customer: row.customers,
          items: items.map(item => ({
            ...item.quotation_items!,
            product: item.products!
          }))
        });
      }
    }

    return quotationsWithDetails;
  }

  async getQuotation(id: string): Promise<QuotationWithDetails | undefined> {
    const [quotationRow] = await db
      .select()
      .from(quotations)
      .leftJoin(customers, eq(quotations.customerId, customers.id))
      .where(eq(quotations.id, id));

    if (!quotationRow?.quotations || !quotationRow?.customers) {
      return undefined;
    }

    const items = await db
      .select()
      .from(quotationItems)
      .leftJoin(products, eq(quotationItems.productId, products.id))
      .where(eq(quotationItems.quotationId, id));

    return {
      ...quotationRow.quotations,
      customer: quotationRow.customers,
      items: items.map(item => ({
        ...item.quotation_items!,
        product: item.products!
      }))
    };
  }

  async createQuotation(quotation: InsertQuotation, items: InsertQuotationItem[]): Promise<QuotationWithDetails> {
    // Generate quotation number
    const count = await db
      .select({ count: sql<number>`count(*)` })
      .from(quotations);
    
    const quotationNumber = `#${String(Number(count[0].count) + 1).padStart(3, '0')}`;

    const [newQuotation] = await db
      .insert(quotations)
      .values({
        ...quotation,
        quotationNumber
      })
      .returning();

    // Insert quotation items
    const quotationItemsWithId = items.map(item => ({
      ...item,
      quotationId: newQuotation.id
    }));

    await db.insert(quotationItems).values(quotationItemsWithId);

    // Return the complete quotation
    const result = await this.getQuotation(newQuotation.id);
    return result!;
  }

  async updateQuotationStatus(id: string, status: string): Promise<Quotation> {
    const [updatedQuotation] = await db
      .update(quotations)
      .set({ status })
      .where(eq(quotations.id, id))
      .returning();
    return updatedQuotation;
  }

  async deleteQuotation(id: string): Promise<void> {
    await db.delete(quotationItems).where(eq(quotationItems.quotationId, id));
    await db.delete(quotations).where(eq(quotations.id, id));
  }
}

export const storage = new DatabaseStorage();
