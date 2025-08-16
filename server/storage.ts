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
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";

export interface IStorage {
  // Customers
  getCustomers(user?: User): Promise<Customer[]>;
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
  getQuotationsByUser(userId: string): Promise<QuotationWithDetails[]>;
  getQuotation(id: string): Promise<QuotationWithDetails | undefined>;
  getQuotationsInDateRange(startDate: Date, endDate: Date): Promise<QuotationWithDetails[]>;
  getQuotationsByUserInDateRange(userId: string, startDate: Date, endDate: Date): Promise<QuotationWithDetails[]>;
  getCustomersByUser(userId: string): Promise<Customer[]>;
  getCalculatedQuotationByOriginal(originalId: string): Promise<QuotationWithDetails | undefined>;
  getEmployeeOriginalQuotations(): Promise<QuotationWithDetails[]>;
  getAdminCalculatedQuotations(): Promise<QuotationWithDetails[]>;
  createQuotation(quotation: InsertQuotation, items: InsertQuotationItem[], costs?: InsertQuotationCost[]): Promise<QuotationWithDetails>;
  updateQuotation(id: string, quotation: any): Promise<QuotationWithDetails>;
  updateQuotationStatus(id: string, status: string): Promise<QuotationWithDetails>;
  updateQuotationCommission(id: string, commission: number): Promise<QuotationWithDetails>;
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
  async getCustomers(user?: User): Promise<Customer[]> {
    if (!user) {
      return await db.select().from(customers).orderBy(desc(customers.createdAt));
    }
    
    // Admin sees all customers
    if (user.type === 'admin') {
      return await db.select().from(customers).orderBy(desc(customers.createdAt));
    }
    
    // Funcionário vê apenas seus próprios clientes
    return await db
      .select()
      .from(customers)
      .where(eq(customers.createdById, user.id))
      .orderBy(desc(customers.createdAt));
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

  // Admin vê apenas propostas originais (não calculadas por admin) criadas por ele mesmo
  async getOriginalQuotations(): Promise<QuotationWithDetails[]> {
    const result = await db
      .select()
      .from(quotations)
      .leftJoin(customers, eq(quotations.customerId, customers.id))
      .leftJoin(users, eq(quotations.userId, users.id))
      .where(eq(quotations.adminCalculated, 0)) // Apenas propostas originais - removido temporariamente
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

  // Buscar apenas propostas originais de funcionários (não calculadas pelo admin)
  async getEmployeeOriginalQuotations(): Promise<QuotationWithDetails[]> {
    const result = await db
      .select()
      .from(quotations)
      .leftJoin(customers, eq(quotations.customerId, customers.id))
      .leftJoin(users, eq(quotations.userId, users.id))
      .where(and(
        eq(users.type, "vendedor"), // Apenas propostas de vendedores
        eq(quotations.adminCalculated, 0) // Apenas propostas originais
      ))
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

  // Buscar propostas calculadas pelo admin (propostas validadas)
  async getAdminCalculatedQuotations(): Promise<QuotationWithDetails[]> {
    const result = await db
      .select()
      .from(quotations)
      .leftJoin(customers, eq(quotations.customerId, customers.id))
      .leftJoin(users, eq(quotations.userId, users.id))
      .where(eq(quotations.adminCalculated, 1)) // Apenas propostas calculadas pelo admin
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

  // Buscar todas as propostas de funcionários para o admin gerenciar
  async getEmployeeQuotations(): Promise<QuotationWithDetails[]> {
    const result = await db
      .select()
      .from(quotations)
      .leftJoin(customers, eq(quotations.customerId, customers.id))
      .leftJoin(users, eq(quotations.userId, users.id))
      .where(eq(users.type, "vendedor")) // Apenas propostas de vendedores
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

  // Para o admin calcular custos: duplica a proposta marcando como calculada
  async duplicateQuotationForAdmin(originalId: string): Promise<QuotationWithDetails> {
    // Get the original quotation
    const original = await this.getQuotation(originalId);
    if (!original) {
      throw new Error("Quotation not found");
    }

    // Generate unique quotation number
    let adminNumber = `${original.quotationNumber}-ADM`;
    let counter = 1;
    
    // Check if quotation number already exists and append counter if needed
    while (true) {
      const existing = await db
        .select()
        .from(quotations)
        .where(eq(quotations.quotationNumber, adminNumber))
        .limit(1);
      
      if (existing.length === 0) {
        break;
      }
      
      counter++;
      adminNumber = `${original.quotationNumber}-ADM-${counter}`;
    }

    // Create a duplicate with admin_calculated = true
    const duplicateData: any = {
      ...original,
      adminCalculated: 1,
      quotationNumber: adminNumber,
    };

    delete duplicateData.id;
    delete duplicateData.customer;
    delete duplicateData.user;
    delete duplicateData.items;
    delete duplicateData.costs;
    delete duplicateData.createdAt;

    const [newQuotation] = await db
      .insert(quotations)
      .values(duplicateData)
      .returning();

    // Copy items
    if (original.items) {
      for (const item of original.items) {
        await db.insert(quotationItems).values({
          quotationId: newQuotation.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unitCost: item.unitCost,
          subtotal: item.subtotal,
          totalCost: item.totalCost
        });
      }
    }

    // Copy costs
    if (original.costs) {
      for (const cost of original.costs) {
        await db.insert(quotationCosts).values({
          quotationId: newQuotation.id,
          costId: cost.costId,
          name: cost.name,
          unitValue: cost.unitValue,
          quantity: cost.quantity,
          totalValue: cost.totalValue,
          supplier: cost.supplier,
          description: cost.description
        });
      }
    }

    const result = await this.getQuotation(newQuotation.id);
    if (!result) {
      throw new Error("Failed to retrieve duplicated quotation");
    }
    return result;
  }

  async updateQuotation(id: string, quotationData: any): Promise<QuotationWithDetails> {
    // Prepare quotation update data with financial calculations
    const updateData: any = {
      ...quotationData,
      updatedAt: new Date(),
    };
    
    // If calculations are provided (admin editing), include all financial calculations
    if (quotationData.calculations) {
      const calc = quotationData.calculations;
      updateData.subtotal = calc.subtotal?.toString();
      updateData.totalCosts = calc.totalCosts?.toString();
      updateData.totalWithoutInvoice = calc.totalWithoutInvoice?.toString();
      updateData.invoicePercent = calc.invoicePercent?.toString();
      updateData.invoiceAmount = calc.invoiceAmount?.toString();
      updateData.totalWithInvoice = calc.totalWithInvoice?.toString();
      updateData.companyProfit = calc.companyProfit?.toString();
      updateData.profitPercent = calc.profitPercent?.toString();
      updateData.tithe = calc.tithe?.toString();
      updateData.netProfit = calc.netProfit?.toString();
      updateData.total = calc.finalTotal?.toString();
      updateData.adminCalculated = true;
      
      console.log('Saving financial calculations:', {
        companyProfit: calc.companyProfit,
        netProfit: calc.netProfit,
        totalCosts: calc.totalCosts
      });
    }
    
    // Remove calculations from the data to be inserted
    delete updateData.calculations;
    delete updateData.items;
    delete updateData.costs;

    // Update the quotation
    const [updatedQuotation] = await db
      .update(quotations)
      .set(updateData)
      .where(eq(quotations.id, id))
      .returning();

    if (!updatedQuotation) {
      throw new Error("Quotation not found");
    }

    // Update items if provided
    if (quotationData.items) {
      // Delete existing items
      await db.delete(quotationItems).where(eq(quotationItems.quotationId, id));
      
      // Insert new items
      for (const item of quotationData.items) {
        const product = await db.select().from(products).where(eq(products.id, item.productId)).limit(1);
        if (product.length > 0) {
          const unitPrice = parseFloat(product[0].pricePerM2);
          const unitCost = parseFloat(product[0].costPerM2 || "0");
          const subtotal = item.quantity * unitPrice;
          const totalCost = item.quantity * unitCost;
          
          await db.insert(quotationItems).values({
            quotationId: id,
            productId: item.productId,
            quantity: item.quantity.toString(),
            unitPrice: unitPrice.toString(),
            unitCost: unitCost.toString(),
            subtotal: subtotal.toString(),
            totalCost: totalCost.toString()
          });
        }
      }
    }

    // Update costs if provided
    if (quotationData.costs) {
      // Delete existing costs
      await db.delete(quotationCosts).where(eq(quotationCosts.quotationId, id));
      
      // Insert new costs
      for (const cost of quotationData.costs) {
        if (cost.costId && cost.costId !== 'manual') {
          // Use existing cost from database
          const costData = await db.select().from(costs).where(eq(costs.id, cost.costId)).limit(1);
          if (costData.length > 0) {
            await db.insert(quotationCosts).values({
              quotationId: id,
              costId: cost.costId,
              name: costData[0].name,
              supplier: costData[0].supplier,
              quantity: cost.quantity?.toString() || "1",
              unitValue: cost.unitValue?.toString() || "0",
              totalValue: cost.totalValue?.toString() || "0",
              description: costData[0].description
            });
          }
        } else {
          // Manual cost
          await db.insert(quotationCosts).values({
            quotationId: id,
            costId: null,
            name: cost.name || 'Custo Manual',
            supplier: cost.supplier || '',
            quantity: cost.quantity?.toString() || "1",
            unitValue: cost.unitValue?.toString() || "0",
            totalValue: cost.totalValue?.toString() || "0",
            description: cost.description || ''
          });
        }
      }
    }

    const result = await this.getQuotation(id);
    if (!result) {
      throw new Error("Failed to retrieve updated quotation");
    }
    return result;
  }

  async getQuotationsByUser(userId: string): Promise<QuotationWithDetails[]> {
    const result = await db
      .select()
      .from(quotations)
      .leftJoin(customers, eq(quotations.customerId, customers.id))
      .leftJoin(users, eq(quotations.userId, users.id))
      .where(and(eq(quotations.userId, userId), eq(quotations.adminCalculated, 0))) // Only original quotations by user
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

  async updateQuotation(id: string, quotationData: any): Promise<QuotationWithDetails> {
    console.log('Storage - updateQuotation called with:', { id, quotationData });
    
    try {
      // Atualizar dados principais da proposta
      const quotationUpdateData = {
        customerId: quotationData.customerId,
        userId: quotationData.userId,
        subtotal: quotationData.subtotal,
        totalCosts: quotationData.totalCosts,
        totalWithoutInvoice: quotationData.totalWithoutInvoice,
        invoicePercent: quotationData.invoicePercent,
        invoiceAmount: quotationData.invoiceAmount,
        totalWithInvoice: quotationData.totalWithInvoice,
        companyProfit: quotationData.companyProfit,
        profitPercent: quotationData.profitPercent,
        tithe: quotationData.tithe,
        netProfit: quotationData.netProfit,
        total: quotationData.total,
        status: quotationData.status || 'pending',
        validUntil: quotationData.validUntil ? new Date(quotationData.validUntil) : undefined,
        notes: quotationData.notes,
        shippingIncluded: quotationData.shippingIncluded,
        warrantyText: quotationData.warrantyText,
        pdfTitle: quotationData.pdfTitle,
        responsibleName: quotationData.responsibleName,
        responsiblePosition: quotationData.responsiblePosition,
        responsibleId: quotationData.responsibleId,
        adminCalculated: quotationData.adminCalculated || 1, // Marcar como calculado pelo admin se estiver sendo atualizado
        branch: quotationData.branch,
      };

      // Remover campos undefined
      Object.keys(quotationUpdateData).forEach(key => {
        if (quotationUpdateData[key] === undefined) {
          delete quotationUpdateData[key];
        }
      });

      console.log('Storage - updating quotation with data:', quotationUpdateData);

      const [updatedQuotation] = await db
        .update(quotations)
        .set(quotationUpdateData)
        .where(eq(quotations.id, id))
        .returning();

      // Atualizar itens se fornecidos
      if (quotationData.items && Array.isArray(quotationData.items)) {
        // Remover itens existentes
        await db.delete(quotationItems).where(eq(quotationItems.quotationId, id));
        
        // Inserir novos itens
        for (const item of quotationData.items) {
          const product = await this.getProduct(item.productId);
          if (product) {
            await db.insert(quotationItems).values({
              quotationId: id,
              productId: item.productId,
              quantity: item.quantity.toString(),
              unitPrice: item.unitPrice.toString(),
              unitCost: product.costPerM2,
              subtotal: (Number(item.quantity) * Number(item.unitPrice)).toString(),
              totalCost: (Number(item.quantity) * Number(product.costPerM2)).toString(),
            });
          }
        }
      }

      // Atualizar custos se fornecidos
      if (quotationData.costs && Array.isArray(quotationData.costs)) {
        // Remover custos existentes
        await db.delete(quotationCosts).where(eq(quotationCosts.quotationId, id));
        
        // Inserir novos custos
        for (const cost of quotationData.costs) {
          await db.insert(quotationCosts).values({
            quotationId: id,
            costId: cost.costId || null,
            name: cost.name,
            unitValue: cost.unitValue.toString(),
            quantity: cost.quantity.toString(),
            totalValue: cost.totalValue.toString(),
            supplier: cost.supplier || null,
            description: cost.description || null,
          });
        }
      }

      // Retornar proposta atualizada com detalhes
      const result = await this.getQuotation(id);
      if (!result) {
        throw new Error('Proposta não encontrada após atualização');
      }
      
      console.log('Storage - quotation updated successfully');
      return result;
    } catch (error) {
      console.error('Storage - error updating quotation:', error);
      throw error;
    }
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

  async updateQuotationCommission(id: string, commission: number): Promise<QuotationWithDetails> {
    // Note: Commission is calculated based on user's commissionPercent, not stored in quotation
    // This method could be used for other quotation updates if needed
    
    // Return complete quotation with details
    const result = await this.getQuotation(id);
    if (!result) {
      throw new Error("Quotation not found");
    }
    return result;
  }

  async getCalculatedQuotationByOriginal(originalId: string): Promise<QuotationWithDetails | undefined> {
    const [quotation] = await db
      .select()
      .from(quotations)
      .where(and(
        eq(quotations.originalQuotationId, originalId),
        eq(quotations.adminCalculated, 1)
      ))
      .limit(1);

    if (!quotation) {
      return undefined;
    }

    return this.getQuotation(quotation.id);
  }

  async getEmployeeOriginalQuotations(): Promise<QuotationWithDetails[]> {
    const quotationResults = await db
      .select()
      .from(quotations)
      .leftJoin(customers, eq(quotations.customerId, customers.id))
      .leftJoin(users, eq(quotations.userId, users.id))
      .where(and(
        eq(quotations.adminCalculated, 0), // Apenas propostas originais
        eq(users.type, 'vendedor') // Apenas de vendedores
      ))
      .orderBy(desc(quotations.createdAt));

    const quotationsWithItems = await Promise.all(
      quotationResults.map(async ({ quotations: quotation, customers: customer, users: user }) => {
        const items = await db
          .select()
          .from(quotationItems)
          .leftJoin(products, eq(quotationItems.productId, products.id))
          .where(eq(quotationItems.quotationId, quotation.id));

        const quotationCostsData = await db
          .select()
          .from(quotationCosts)
          .leftJoin(costs as any, eq(quotationCosts.costId, costs.id))
          .where(eq(quotationCosts.quotationId, quotation.id));

        return {
          ...quotation,
          customer: customer!,
          user: user!,
          items: items.map(item => ({
            ...item.quotation_items,
            product: item.products!
          })),
          costs: quotationCostsData.map(cost => ({
            ...cost.quotation_costs,
            cost: cost.costs
          }))
        } as QuotationWithDetails;
      })
    );

    return quotationsWithItems;
  }

  async getAdminCalculatedQuotations(): Promise<QuotationWithDetails[]> {
    const quotationResults = await db
      .select()
      .from(quotations)
      .leftJoin(customers, eq(quotations.customerId, customers.id))
      .leftJoin(users, eq(quotations.userId, users.id))
      .where(eq(quotations.adminCalculated, 1))
      .orderBy(desc(quotations.createdAt));

    const quotationsWithItems = await Promise.all(
      quotationResults.map(async ({ quotations: quotation, customers: customer, users: user }) => {
        const items = await db
          .select()
          .from(quotationItems)
          .leftJoin(products, eq(quotationItems.productId, products.id))
          .where(eq(quotationItems.quotationId, quotation.id));

        const quotationCostsData = await db
          .select()
          .from(quotationCosts)
          .leftJoin(costs as any, eq(quotationCosts.costId, costs.id))
          .where(eq(quotationCosts.quotationId, quotation.id));

        return {
          ...quotation,
          customer: customer!,
          user: user!,
          items: items.map(item => ({
            ...item.quotation_items,
            product: item.products!
          })),
          costs: quotationCostsData.map(cost => ({
            ...cost.quotation_costs,
            cost: cost.costs
          }))
        } as QuotationWithDetails;
      })
    );

    return quotationsWithItems;
  }

  async deleteQuotation(id: string): Promise<void> {
    // First delete all quotation items
    await db.delete(quotationItems).where(eq(quotationItems.quotationId, id));
    // Delete all quotation costs
    await db.delete(quotationCosts).where(eq(quotationCosts.quotationId, id));
    // Then delete the quotation
    await db.delete(quotations).where(eq(quotations.id, id));
  }

  async getQuotationsInDateRange(startDate: Date, endDate: Date): Promise<QuotationWithDetails[]> {
    console.log(`Storage - getQuotationsInDateRange: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    const result = await db
      .select({
        quotation: quotations,
        customer: customers,
        user: users,
      })
      .from(quotations)
      .leftJoin(customers, eq(quotations.customerId, customers.id))
      .leftJoin(users, eq(quotations.userId, users.id))
      .where(
        and(
          gte(quotations.createdAt, startDate),
          lte(quotations.createdAt, endDate)
        )
      )
      .orderBy(desc(quotations.createdAt));
      
    console.log(`Storage - Found ${result.length} quotations in database`);

    // Group by quotation and fetch related data
    const quotationsMap = new Map<string, QuotationWithDetails>();

    for (const row of result) {
      if (!quotationsMap.has(row.quotation.id)) {
        quotationsMap.set(row.quotation.id, {
          ...row.quotation,
          customer: row.customer!,
          user: row.user!,
          items: [],
          costs: []
        });
      }
    }

    // Fetch items and costs for each quotation
    for (const quotation of quotationsMap.values()) {
      const items = await db
        .select({
          quotationItem: quotationItems,
          product: products,
        })
        .from(quotationItems)
        .leftJoin(products, eq(quotationItems.productId, products.id))
        .where(eq(quotationItems.quotationId, quotation.id));

      quotation.items = items.map(item => ({
        ...item.quotationItem,
        product: item.product!
      }));

      const costs = await db
        .select()
        .from(quotationCosts)
        .where(eq(quotationCosts.quotationId, quotation.id));

      quotation.costs = costs;
    }

    return Array.from(quotationsMap.values());
  }

  async getQuotationsByUserInDateRange(userId: string, startDate: Date, endDate: Date): Promise<QuotationWithDetails[]> {
    console.log(`Storage - getQuotationsByUserInDateRange for user ${userId}: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    const result = await db
      .select({
        quotation: quotations,
        customer: customers,
        user: users,
      })
      .from(quotations)
      .leftJoin(customers, eq(quotations.customerId, customers.id))
      .leftJoin(users, eq(quotations.userId, users.id))
      .where(
        and(
          eq(quotations.userId, userId),
          gte(quotations.createdAt, startDate),
          lte(quotations.createdAt, endDate)
        )
      )
      .orderBy(desc(quotations.createdAt));
      
    console.log(`Storage - Found ${result.length} quotations for user`);

    // Group by quotation and fetch related data
    const quotationsMap = new Map<string, QuotationWithDetails>();

    for (const row of result) {
      if (!quotationsMap.has(row.quotation.id)) {
        quotationsMap.set(row.quotation.id, {
          ...row.quotation,
          customer: row.customer!,
          user: row.user!,
          items: [],
          costs: []
        });
      }
    }

    // Fetch items and costs for each quotation
    for (const quotation of quotationsMap.values()) {
      const items = await db
        .select({
          quotationItem: quotationItems,
          product: products,
        })
        .from(quotationItems)
        .leftJoin(products, eq(quotationItems.productId, products.id))
        .where(eq(quotationItems.quotationId, quotation.id));

      quotation.items = items.map(item => ({
        ...item.quotationItem,
        product: item.product!
      }));

      const costs = await db
        .select()
        .from(quotationCosts)
        .where(eq(quotationCosts.quotationId, quotation.id));

      quotation.costs = costs;
    }

    return Array.from(quotationsMap.values());
  }

  async getCustomersByUser(userId: string): Promise<Customer[]> {
    return await db
      .select()
      .from(customers)
      .where(eq(customers.createdById, userId))
      .orderBy(customers.name);
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
          type: "vendedor",
          branch: "Filial Norte"
        },
        {
          name: "Ana Lima",
          email: "ana@filial2.com",
          password: "func456",
          type: "vendedor",
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
