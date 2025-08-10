import { 
  customers, 
  products, 
  quotations, 
  quotationItems,
  costs,
  quotationCosts,
  users,
  type Customer, 
  type InsertCustomer,
  type Product,
  type InsertProduct,
  type Quotation,
  type InsertQuotation,
  type QuotationItem,
  type InsertQuotationItem,
  type Cost,
  type InsertCost,
  type QuotationCost,
  type InsertQuotationCost,
  type QuotationWithDetails,
  type User,
  type InsertUser,
  type LoginUser
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
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  initializeDefaultProducts(): Promise<void>;

  // Costs
  getCosts(): Promise<Cost[]>;
  getCost(id: string): Promise<Cost | undefined>;
  createCost(cost: InsertCost): Promise<Cost>;
  updateCost(id: string, cost: Partial<InsertCost>): Promise<Cost>;
  deleteCost(id: string): Promise<void>;

  // Quotations
  getQuotations(branch?: string): Promise<QuotationWithDetails[]>;
  getQuotation(id: string): Promise<QuotationWithDetails | undefined>;
  createQuotation(quotation: InsertQuotation, items: InsertQuotationItem[], costs?: InsertQuotationCost[]): Promise<QuotationWithDetails>;
  updateQuotationStatus(id: string, status: string): Promise<Quotation>;
  deleteQuotation(id: string): Promise<void>;

  // Users
  getUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  authenticateUser(email: string, password: string): Promise<User | null>;
  initializeDefaultUsers(): Promise<void>;
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

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product> {
    const [updatedProduct] = await db
      .update(products)
      .set(product)
      .where(eq(products.id, id))
      .returning();
    return updatedProduct;
  }

  async deleteProduct(id: string): Promise<void> {
    // Check if product is used in any quotations
    const usageCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(quotationItems)
      .where(eq(quotationItems.productId, id));
    
    if (Number(usageCount[0].count) > 0) {
      throw new Error("Não é possível excluir este produto pois ele está sendo usado em orçamentos existentes.");
    }
    
    await db.delete(products).where(eq(products.id, id));
  }

  async initializeDefaultProducts(): Promise<void> {
    const existingProducts = await this.getProducts();
    if (existingProducts.length === 0) {
      const defaultProducts = [
        {
          name: "Grama Sintética",
          pricePerM2: "64.00",
          costPerM2: "40.00",
          category: "Grama",
          hasInstallation: 1,
          description: "Grama sintética de alta qualidade para jardins e áreas externas"
        },
        {
          name: "Capacho Vinil",
          pricePerM2: "55.00",
          costPerM2: "35.00",
          category: "Carpete",
          hasInstallation: 0,
          description: "Capacho de vinil resistente para entrada de estabelecimentos"
        },
        {
          name: "Piso Tátil",
          pricePerM2: "52.00",
          costPerM2: "30.00",
          category: "Piso",
          hasInstallation: 1,
          description: "Piso tátil para acessibilidade de pessoas com deficiência visual"
        }
      ];

      for (const product of defaultProducts) {
        await this.createProduct(product);
      }
    }
  }

  // Costs
  async getCosts(): Promise<Cost[]> {
    return await db.select().from(costs).orderBy(costs.name);
  }

  async getCost(id: string): Promise<Cost | undefined> {
    const [cost] = await db.select().from(costs).where(eq(costs.id, id));
    return cost;
  }

  async createCost(cost: InsertCost): Promise<Cost> {
    const [newCost] = await db.insert(costs).values(cost).returning();
    return newCost;
  }

  async updateCost(id: string, cost: Partial<InsertCost>): Promise<Cost> {
    const [updatedCost] = await db
      .update(costs)
      .set(cost)
      .where(eq(costs.id, id))
      .returning();
    return updatedCost;
  }

  async deleteCost(id: string): Promise<void> {
    // Check if cost is used in any quotations
    const usageCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(quotationCosts)
      .where(eq(quotationCosts.costId, id));
    
    if (Number(usageCount[0].count) > 0) {
      throw new Error("Não é possível excluir este custo pois ele está sendo usado em propostas existentes.");
    }
    
    await db.delete(costs).where(eq(costs.id, id));
  }

  // Quotations
  async getQuotations(): Promise<QuotationWithDetails[]> {
    const result = await db
      .select()
      .from(quotations)
      .leftJoin(customers, eq(quotations.customerId, customers.id))
      .leftJoin(users, eq(quotations.userId, users.id))
      .orderBy(quotations.createdAt);

    const quotationsWithDetails: QuotationWithDetails[] = [];

    for (const row of result) {
      if (row.quotations && row.customers && row.users) {
        const items = await db
          .select()
          .from(quotationItems)
          .leftJoin(products, eq(quotationItems.productId, products.id))
          .where(eq(quotationItems.quotationId, row.quotations.id));

        // Get costs for this quotation
        const quotationCostsData = await db
          .select()
          .from(quotationCosts)
          .leftJoin(costs, eq(quotationCosts.costId, costs.id))
          .where(eq(quotationCosts.quotationId, row.quotations.id));

        quotationsWithDetails.push({
          ...row.quotations,
          customer: row.customers,
          user: row.users,
          items: items.map(item => ({
            ...item.quotation_items!,
            product: item.products!
          })),
          costs: quotationCostsData.map(costData => ({
            ...costData.quotation_costs!,
            cost: costData.costs || undefined
          }))
        });
      }
    }

    return quotationsWithDetails;
  }

  async getQuotationsByUser(userId: string): Promise<QuotationWithDetails[]> {
    const result = await db
      .select()
      .from(quotations)
      .leftJoin(customers, eq(quotations.customerId, customers.id))
      .leftJoin(users, eq(quotations.userId, users.id))
      .where(eq(quotations.userId, userId))
      .orderBy(quotations.createdAt);

    const quotationsWithDetails: QuotationWithDetails[] = [];

    for (const row of result) {
      if (row.quotations && row.customers && row.users) {
        const items = await db
          .select()
          .from(quotationItems)
          .leftJoin(products, eq(quotationItems.productId, products.id))
          .where(eq(quotationItems.quotationId, row.quotations.id));

        // Get costs for this quotation
        const quotationCostsData = await db
          .select()
          .from(quotationCosts)
          .leftJoin(costs, eq(quotationCosts.costId, costs.id))
          .where(eq(quotationCosts.quotationId, row.quotations.id));

        quotationsWithDetails.push({
          ...row.quotations,
          customer: row.customers,
          user: row.users,
          items: items.map(item => ({
            ...item.quotation_items!,
            product: item.products!
          })),
          costs: quotationCostsData.map(costData => ({
            ...costData.quotation_costs!,
            cost: costData.costs || undefined
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
      .leftJoin(users, eq(quotations.userId, users.id))
      .where(eq(quotations.id, id));

    if (!quotationRow?.quotations || !quotationRow?.customers || !quotationRow?.users) {
      return undefined;
    }

    const items = await db
      .select()
      .from(quotationItems)
      .leftJoin(products, eq(quotationItems.productId, products.id))
      .where(eq(quotationItems.quotationId, id));

    // Get costs for this quotation
    const quotationCostsData = await db
      .select()
      .from(quotationCosts)
      .leftJoin(costs, eq(quotationCosts.costId, costs.id))
      .where(eq(quotationCosts.quotationId, id));

    return {
      ...quotationRow.quotations,
      customer: quotationRow.customers,
      user: quotationRow.users,
      items: items.map(item => ({
        ...item.quotation_items!,
        product: item.products!
      })),
      costs: quotationCostsData.map(costData => ({
        ...costData.quotation_costs!,
        cost: costData.costs || undefined
      }))
    };
  }

  async createQuotation(quotation: InsertQuotation, items: InsertQuotationItem[], costs?: InsertQuotationCost[]): Promise<QuotationWithDetails> {
    // Generate unique quotation number using timestamp and random number
    const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    const quotationNumber = `#${timestamp}${random}`;

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

    // Insert quotation costs if provided
    if (costs && costs.length > 0) {
      const quotationCostsWithId = costs.map(cost => ({
        ...cost,
        quotationId: newQuotation.id
      }));

      await db.insert(quotationCosts).values(quotationCostsWithId);
    }

    // Return the complete quotation
    const result = await this.getQuotation(newQuotation.id);
    return result!;
  }

  async updateQuotationStatus(id: string, status: string): Promise<QuotationWithDetails> {
    // Update quotation status
    const [updatedQuotation] = await db
      .update(quotations)
      .set({ status })
      .where(eq(quotations.id, id))
      .returning();
    
    if (!updatedQuotation) {
      throw new Error("Quotation not found");
    }

    // Return complete quotation with details
    const result = await this.getQuotation(id);
    return result!;
  }

  async deleteQuotation(id: string): Promise<void> {
    // First delete all quotation items
    await db.delete(quotationItems).where(eq(quotationItems.quotationId, id));
    // Delete all quotation costs
    await db.delete(quotationCosts).where(eq(quotationCosts.quotationId, id));
    // Then delete the quotation
    await db.delete(quotations).where(eq(quotations.id, id));
  }

  // Users
  async getUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.name);
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: string, user: Partial<InsertUser>): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set(user)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async authenticateUser(email: string, password: string): Promise<User | null> {
    const user = await this.getUserByEmail(email);
    if (user && user.password === password) {
      return user;
    }
    return null;
  }

  async initializeDefaultUsers(): Promise<void> {
    const existingUsers = await this.getUsers();
    if (existingUsers.length === 0) {
      const defaultUsers = [
        {
          name: "Gabriel Trindade",
          email: "admin@mastergreen.com",
          password: "admin123",
          type: "admin",
          branch: "Matriz"
        },
        {
          name: "João Silva",
          email: "joao@filial1.com",
          password: "func123",
          type: "funcionario",
          branch: "Filial Norte"
        },
        {
          name: "Ana Lima",
          email: "ana@filial2.com",
          password: "func456",
          type: "funcionario",
          branch: "Filial Sul"
        }
      ];

      for (const user of defaultUsers) {
        await this.createUser(user);
      }
    }
  }
}

export const storage = new DatabaseStorage();
