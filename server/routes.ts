import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertCustomerSchema, 
  insertProductSchema,
  insertQuotationSchema, 
  insertQuotationItemSchema,
  insertCostSchema,
  insertQuotationCostSchema,
  insertUserSchema,
  loginUserSchema,
  type User 
} from "@shared/schema";
import { z } from "zod";
import session from "express-session";

const createQuotationSchema = z.object({
  quotation: insertQuotationSchema.omit({ userId: true, branch: true }).extend({
    validUntil: z.string().transform((str) => new Date(str))
  }),
  items: z.array(insertQuotationItemSchema.omit({ quotationId: true })),
  costs: z.array(insertQuotationCostSchema.omit({ quotationId: true })).optional()
});

// Session configuration
declare module 'express-session' {
  interface SessionData {
    user?: User;
  }
}

// Auth middleware
function requireAuth(req: any, res: any, next: any) {
  if (!req.session.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

function requireAdmin(req: any, res: any, next: any) {
  if (!req.session.user || req.session.user.type !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Configure sessions
  app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-here',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in production with HTTPS
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Initialize default data
  await storage.initializeDefaultProducts();
  await storage.initializeDefaultUsers();

  // Auth routes
  app.post("/api/login", async (req, res) => {
    try {
      const { email, password } = loginUserSchema.parse(req.body);
      const user = await storage.authenticateUser(email, password);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      req.session.user = user;
      res.json({ user, message: "Login successful" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid login data", errors: error.errors });
      }
      console.error("Error during login:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logout successful" });
    });
  });

  app.get("/api/me", requireAuth, (req, res) => {
    res.json(req.session.user);
  });

  // User management routes (admin only)
  app.get("/api/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      res.status(201).json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.put("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const userData = insertUserSchema.partial().parse(req.body);
      const user = await storage.updateUser(req.params.id, userData);
      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteUser(req.params.id);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Customer routes
  app.get("/api/customers", requireAuth, async (req, res) => {
    try {
      const user = req.session.user!;
      const customers = await storage.getCustomers(user);
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  app.get("/api/customers/:id", async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      console.error("Error fetching customer:", error);
      res.status(500).json({ message: "Failed to fetch customer" });
    }
  });

  app.post("/api/customers", requireAuth, async (req, res) => {
    try {
      const user = req.session.user!;
      const customerData = insertCustomerSchema.parse(req.body);
      // Add createdById to track who created the customer
      const customerWithCreator = { ...customerData, createdById: user.id };
      const customer = await storage.createCustomer(customerWithCreator);
      res.status(201).json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid customer data", errors: error.errors });
      }
      console.error("Error creating customer:", error);
      res.status(500).json({ message: "Failed to create customer" });
    }
  });

  app.put("/api/customers/:id", async (req, res) => {
    try {
      const customerData = insertCustomerSchema.partial().parse(req.body);
      const customer = await storage.updateCustomer(req.params.id, customerData);
      res.json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid customer data", errors: error.errors });
      }
      console.error("Error updating customer:", error);
      res.status(500).json({ message: "Failed to update customer" });
    }
  });

  app.delete("/api/customers/:id", async (req, res) => {
    try {
      await storage.deleteCustomer(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting customer:", error);
      res.status(500).json({ message: "Failed to delete customer" });
    }
  });

  // Product routes
  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.post("/api/products", requireAuth, async (req, res) => {
    try {
      const productData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(productData);
      res.status(201).json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid product data", errors: error.errors });
      }
      console.error("Error creating product:", error);
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  app.put("/api/products/:id", requireAuth, async (req, res) => {
    try {
      const productData = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(req.params.id, productData);
      res.json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid product data", errors: error.errors });
      }
      console.error("Error updating product:", error);
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteProduct(req.params.id);
      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  // Cost routes
  app.get("/api/costs", requireAuth, async (req, res) => {
    try {
      const costs = await storage.getCosts();
      res.json(costs);
    } catch (error) {
      console.error("Error fetching costs:", error);
      res.status(500).json({ message: "Failed to fetch costs" });
    }
  });

  app.get("/api/costs/:id", requireAuth, async (req, res) => {
    try {
      const cost = await storage.getCost(req.params.id);
      if (!cost) {
        return res.status(404).json({ message: "Cost not found" });
      }
      res.json(cost);
    } catch (error) {
      console.error("Error fetching cost:", error);
      res.status(500).json({ message: "Failed to fetch cost" });
    }
  });

  app.post("/api/costs", requireAuth, async (req, res) => {
    try {
      const costData = insertCostSchema.parse(req.body);
      const cost = await storage.createCost(costData);
      res.status(201).json(cost);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid cost data", errors: error.errors });
      }
      console.error("Error creating cost:", error);
      res.status(500).json({ message: "Failed to create cost" });
    }
  });

  app.put("/api/costs/:id", requireAuth, async (req, res) => {
    try {
      const costData = insertCostSchema.partial().parse(req.body);
      const cost = await storage.updateCost(req.params.id, costData);
      res.json(cost);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid cost data", errors: error.errors });
      }
      console.error("Error updating cost:", error);
      res.status(500).json({ message: "Failed to update cost" });
    }
  });

  app.delete("/api/costs/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteCost(req.params.id);
      res.json({ message: "Cost deleted successfully" });
    } catch (error) {
      console.error("Error deleting cost:", error);
      
      // Se é um erro de validação de negócio (custo em uso), retornar 400
      if (error instanceof Error && error.message.includes("está sendo usado")) {
        return res.status(400).json({ message: error.message });
      }
      
      // Outros erros retornam 500
      res.status(500).json({ message: "Failed to delete cost" });
    }
  });

  // Quotation routes
  app.get("/api/quotations", requireAuth, async (req, res) => {
    try {
      const user = req.session.user!;
      console.log("Getting quotations for user:", user);
      
      let quotations;
      if (user.type === "admin") {
        // Admin vê apenas suas próprias propostas
        quotations = await storage.getQuotationsByUser(user.id);
      } else {
        // Funcionários veem suas próprias propostas
        quotations = await storage.getQuotationsByUser(user.id);
      }
      
      res.json(quotations);
    } catch (error) {
      console.error("Error fetching quotations:", error);
      res.status(500).json({ message: "Failed to fetch quotations" });
    }
  });

  app.get("/api/quotations/:id", requireAuth, async (req, res) => {
    try {
      const quotation = await storage.getQuotation(req.params.id);
      if (!quotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }
      
      const user = req.session.user!;
      // Vendedores só podem ver orçamentos da própria filial
      if (user.type === "vendedor" && quotation.branch !== user.branch) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(quotation);
    } catch (error) {
      console.error("Error fetching quotation:", error);
      res.status(500).json({ message: "Failed to fetch quotation" });
    }
  });

  app.post("/api/quotations", requireAuth, async (req, res) => {
    try {
      const user = req.session.user!;
      console.log("Received quotation data:", JSON.stringify(req.body, null, 2));
      
      const { customerId, validUntil, notes, items, costs, calculations } = req.body;
      
      // Criar dados do orçamento com nova estrutura
      const quotationData = {
        customerId,
        userId: user.id,
        branch: user.branch,
        validUntil: new Date(validUntil),
        notes: notes || null,
        subtotal: calculations.subtotal.toString(),
        totalCosts: calculations.totalCosts.toString(),
        totalWithoutInvoice: calculations.totalWithoutInvoice.toString(),
        invoicePercent: calculations.invoicePercent.toString(),
        invoiceAmount: calculations.invoiceAmount.toString(),
        totalWithInvoice: calculations.totalWithInvoice.toString(),
        companyProfit: calculations.companyProfit.toString(),
        profitPercent: calculations.profitPercent.toString(),
        tithe: calculations.tithe.toString(),
        netProfit: calculations.netProfit.toString(),
        total: calculations.total.toString(),
        shippingIncluded: req.body.shippingIncluded ? 1 : 0,
        warrantyText: req.body.warrantyText || "1 ano de garantia de fábrica",
        pdfTitle: req.body.pdfTitle || null,
        responsibleName: req.body.responsibleName || user.name,
        responsiblePosition: req.body.responsiblePosition || "Administrador",
        responsibleId: user.id,
      };
      
      // Mapear itens
      const itemsData = items.map((item: any) => ({
        productId: item.productId,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
        unitCost: "0.00", // Será calculado se necessário
        subtotal: (item.quantity * item.unitPrice).toString(),
        totalCost: "0.00",
      }));
      
      // Mapear custos
      const costsData = costs ? costs.map((cost: any) => ({
        costId: cost.costId === 'manual' ? null : cost.costId,
        name: cost.name,
        unitValue: cost.unitValue.toString(),
        quantity: cost.quantity.toString(),
        totalValue: cost.totalValue.toString(),
        supplier: cost.supplier || null,
        description: cost.description || null,
      })) : [];
      
      console.log("Processed quotation:", quotationData);
      console.log("Processed items:", itemsData);
      console.log("Processed costs:", costsData);
      
      const newQuotation = await storage.createQuotation(quotationData, itemsData, costsData);
      res.status(201).json(newQuotation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation errors:", error.errors);
        return res.status(400).json({ message: "Invalid quotation data", errors: error.errors });
      }
      console.error("Error creating quotation:", error);
      res.status(500).json({ message: "Failed to create quotation" });
    }
  });

  app.put("/api/quotations/:id/status", requireAuth, async (req, res) => {
    try {
      const { status } = req.body;
      if (!['pending', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      const quotation = await storage.updateQuotationStatus(req.params.id, status);
      res.json(quotation);
    } catch (error) {
      console.error("Error updating quotation status:", error);
      res.status(500).json({ message: "Failed to update quotation status" });
    }
  });

  // Update quotation (full update for admin editing)
  app.put("/api/quotations/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.session.user!;
      console.log('=== UPDATE QUOTATION START ===');
      console.log('Quotation ID:', id);
      console.log('User:', user.name, 'Type:', user.type);
      console.log('Is Admin Calculated:', req.body.adminCalculated);
      
      // Verificar se a proposta existe
      const existingQuotation = await storage.getQuotation(id);
      if (!existingQuotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }
      
      // LÓGICA CRÍTICA: Se admin está editando proposta de vendedor, criar nova proposta calculada
      if (user.type === 'admin' && req.body.adminCalculated && existingQuotation.userId !== user.id) {
        console.log('ADMIN CREATING CALCULATED VERSION - Do not modify original!');
        
        // Verificar se já existe uma versão calculada para esta proposta original
        const existingCalculated = await storage.getCalculatedQuotationByOriginal(id);
        
        if (existingCalculated) {
          console.log('Updating existing calculated quotation:', existingCalculated.id);
          // Atualizar a versão calculada existente
          const updatedCalculated = await storage.updateQuotation(existingCalculated.id, {
            ...req.body,
            userId: existingQuotation.userId, // Manter vendedor original
            status: existingQuotation.status, // INHERIT STATUS FROM ORIGINAL QUOTATION
            responsibleId: existingQuotation.userId, // Referência ao vendedor
            adminCalculated: true,
            originalQuotationId: id,
          });
          return res.json(updatedCalculated);
        } else {
          console.log('Creating new calculated quotation for original:', id);
          // Criar nova proposta calculada
          const { customerId, validUntil, notes, items, costs, calculations } = req.body;
          
          const quotationData = {
            customerId,
            userId: existingQuotation.userId, // Manter vendedor original
            branch: existingQuotation.branch,
            validUntil: new Date(validUntil),
            notes: notes || null,
            subtotal: calculations.subtotal.toString(),
            totalCosts: calculations.totalCosts.toString(),
            totalWithoutInvoice: calculations.totalWithoutInvoice.toString(),
            invoicePercent: calculations.invoicePercent.toString(),
            invoiceAmount: calculations.invoiceAmount.toString(),
            totalWithInvoice: calculations.totalWithInvoice.toString(),
            companyProfit: calculations.companyProfit.toString(),
            profitPercent: calculations.profitPercent.toString(),
            tithe: calculations.tithe.toString(),
            netProfit: calculations.netProfit.toString(),
            total: calculations.total.toString(),
            status: existingQuotation.status, // INHERIT STATUS FROM ORIGINAL QUOTATION
            shippingIncluded: req.body.shippingIncluded ? 1 : 0,
            warrantyText: req.body.warrantyText || "1 ano de garantia de fábrica",
            pdfTitle: req.body.pdfTitle || null,
            responsibleName: req.body.responsibleName || existingQuotation.responsibleName,
            responsiblePosition: req.body.responsiblePosition || "Administrador",
            responsibleId: existingQuotation.userId, // Referência ao vendedor
            adminCalculated: true,
            originalQuotationId: id,
          };
          
          const itemsData = items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity.toString(),
            unitPrice: item.unitPrice.toString(),
            unitCost: "0.00",
            subtotal: (item.quantity * item.unitPrice).toString(),
            totalCost: "0.00",
          }));
          
          const costsData = costs ? costs.map((cost: any) => ({
            costId: cost.costId === 'manual' ? null : cost.costId,
            name: cost.name,
            unitValue: cost.unitValue.toString(),
            quantity: cost.quantity.toString(),
            totalValue: cost.totalValue.toString(),
            supplier: cost.supplier || null,
            description: cost.description || null,
          })) : [];
          
          const newCalculatedQuotation = await storage.createQuotation(quotationData, itemsData, costsData);
          console.log('Created calculated quotation:', newCalculatedQuotation.id);
          return res.json(newCalculatedQuotation);
        }
      } else {
        console.log('NORMAL UPDATE - Vendor editing own quotation');
        // Edição normal (vendedor editando própria proposta)
        const mergedData = {
          ...req.body,
          userId: existingQuotation.userId,
          createdAt: existingQuotation.createdAt,
          quotationNumber: existingQuotation.quotationNumber,
        };
        
        const updatedQuotation = await storage.updateQuotation(id, mergedData);
        console.log('=== UPDATE QUOTATION END ===');
        res.json(updatedQuotation);
      }
    } catch (error) {
      console.error("Error updating quotation:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Validation error",
          error: JSON.stringify(error.errors, null, 2)
        });
      }
      res.status(500).json({ 
        message: "Error updating quotation",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Update quotation commission (admin only)
  app.patch("/api/quotations/:id/commission", requireAdmin, async (req, res) => {
    try {
      const { commission } = req.body;
      
      if (typeof commission !== 'number' || commission < 0 || commission > 100) {
        return res.status(400).json({ message: "Commission must be a number between 0 and 100" });
      }
      
      const quotation = await storage.updateQuotationCommission(req.params.id, commission);
      res.json(quotation);
    } catch (error) {
      console.error("Error updating quotation commission:", error);
      res.status(500).json({ message: "Failed to update quotation commission" });
    }
  });



  // Duplicate quotation for admin to calculate costs
  app.post("/api/quotations/:id/calculate-costs", requireAuth, async (req, res) => {
    try {
      const user = req.session.user!;
      if (user.type !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const duplicatedQuotation = await storage.duplicateQuotationForAdmin(req.params.id);
      res.json(duplicatedQuotation);
    } catch (error) {
      console.error("Error duplicating quotation for admin:", error);
      res.status(500).json({ message: "Failed to duplicate quotation" });
    }
  });

  app.delete("/api/quotations/:id", requireAuth, async (req, res) => {
    try {
      const user = req.session.user!;
      
      // Check if user has permission to delete
      if (user.type !== "admin") {
        const quotation = await storage.getQuotation(req.params.id);
        if (!quotation || quotation.userId !== user.id) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      await storage.deleteQuotation(req.params.id);
      res.json({ message: "Quotation deleted successfully" });
    } catch (error) {
      console.error("Error deleting quotation:", error);
      res.status(500).json({ message: "Failed to delete quotation" });
    }
  });

  // Admin endpoint to get original employee quotations for management
  app.get("/api/employee-quotations", requireAdmin, async (req, res) => {
    try {
      // Get original quotations from employees (not admin-calculated)
      const quotations = await storage.getEmployeeOriginalQuotations();
      res.json(quotations);
    } catch (error) {
      console.error("Error fetching employee quotations:", error);
      res.status(500).json({ message: "Failed to fetch employee quotations" });
    }
  });

  // Admin endpoint to get admin-calculated quotations (validated proposals)
  app.get("/api/admin-calculated-quotations", requireAdmin, async (req, res) => {
    try {
      // Get quotations that have been calculated by admin
      const quotations = await storage.getAdminCalculatedQuotations();
      res.json(quotations);
    } catch (error) {
      console.error("Error fetching admin calculated quotations:", error);
      res.status(500).json({ message: "Failed to fetch admin calculated quotations" });
    }
  });

  // Dashboard endpoint
  app.get("/api/dashboard/:date?", requireAuth, async (req, res) => {
    try {
      const user = req.session.user!;
      const selectedDate = (req.params.date as string) || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      
      const [year, month] = selectedDate.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      
      console.log(`Dashboard - Date: ${selectedDate}, Start: ${startDate.toISOString()}, End: ${endDate.toISOString()}`);

      if (user.type === "admin") {
        // Admin dashboard - comprehensive system view
        const allQuotations = await storage.getQuotationsInDateRange(startDate, endDate);
        console.log(`Admin Dashboard - Found ${allQuotations.length} quotations in date range`);
        const allCustomers = await storage.getCustomers();
        const allUsers = await storage.getUsers();
        const employees = allUsers.filter(u => u.type === "vendedor");

        const approvedQuotations = allQuotations.filter(q => q.status === 'approved');
        const pendingQuotations = allQuotations.filter(q => q.status === 'pending');
        
        // Calculate admin dashboard metrics according to new business rules
        let totalRevenue = 0; // Valor bruto total (nunca muda)
        let totalCosts = 0; // Custos adicionados pelo admin
        let totalNetProfit = 0; // Lucro líquido calculado pelo admin
        
        // REGRA: Receita Total = soma do valor bruto de TODAS as propostas aprovadas
        // (vendedores + admin), independente de terem custos calculados
        approvedQuotations.forEach(q => {
          const revenue = parseFloat(q.total || '0');
          totalRevenue += revenue;
          console.log(`Dashboard - Adding revenue from quotation ${q.quotationNumber}: ${revenue}`);
        });
        
        // Separar propostas com custos calculados pelo admin
        const adminCalculatedQuotations = approvedQuotations.filter(q => q.adminCalculated === 1);
        
        // REGRA: Custos e Lucro Líquido = apenas das propostas que o admin já processou
        adminCalculatedQuotations.forEach(q => {
          const costs = parseFloat(q.totalCosts || '0');
          const netProfit = parseFloat(q.netProfit || '0');
          
          totalCosts += costs;
          totalNetProfit += netProfit;
          
          console.log(`Dashboard - Admin processed quotation ${q.quotationNumber}: costs=${costs}, netProfit=${netProfit}`);
        });
        const conversionRate = allQuotations.length > 0 
          ? (approvedQuotations.length / allQuotations.length) * 100 
          : 0;

        // Calculate commissions by employee - BASEADO EM PROPOSTAS ORIGINAIS APROVADAS
        const commissionsByEmployee = employees.map(employee => {
          // REGRA: Comissão baseada apenas em propostas ORIGINAIS aprovadas do vendedor
          const employeeOriginalApproved = approvedQuotations.filter(q => 
            q.userId === employee.id && q.adminCalculated === 0
          );
          const commissionPercent = parseFloat(employee.commissionPercent || '0');
          const totalSales = employeeOriginalApproved.reduce((sum, q) => sum + parseFloat(q.total), 0);
          const totalCommission = totalSales * commissionPercent / 100;
          
          // Total de propostas originais do vendedor (para conversão)
          const employeeOriginalQuotations = allQuotations.filter(q => 
            q.userId === employee.id && q.adminCalculated === 0
          );
          
          return {
            employeeId: employee.id,
            employeeName: employee.name,
            employeeBranch: employee.branch,
            commissionPercent,
            totalSales,
            totalCommission,
            quotationsCount: employeeOriginalApproved.length, // Apenas originais aprovadas
            allQuotationsCount: employeeOriginalQuotations.length, // Apenas originais totais
            conversionRate: employeeOriginalQuotations.length > 0 
              ? (employeeOriginalApproved.length / employeeOriginalQuotations.length) * 100 
              : 0
          };
        });

        const totalCommissionsPaid = commissionsByEmployee.reduce((sum, emp) => sum + emp.totalCommission, 0);
        
        console.log(`Dashboard Summary - Total Revenue: ${totalRevenue}, Total Costs: ${totalCosts}, Net Profit: ${totalNetProfit}, Commissions: ${totalCommissionsPaid}`);

        res.json({
          type: "admin",
          totalRevenue, // Valor bruto total (nunca muda)
          totalCosts, // Custos adicionados pelo admin
          totalNetProfit, // Lucro líquido das propostas processadas pelo admin
          pendingQuotations: pendingQuotations.length,
          activeCustomers: allCustomers.length,
          conversionRate,
          approvedQuotations: approvedQuotations.length,
          totalQuotations: allQuotations.length,
          commissionsByEmployee,
          totalCommissionsPaid,
          employeesCount: employees.length,
          // Dados adicionais para o dashboard do admin
          processedQuotations: adminCalculatedQuotations.length, // Quantas propostas já foram processadas
          pendingProcessing: approvedQuotations.length - adminCalculatedQuotations.length // Quantas ainda precisam ser processadas
        });
      } else {
        // Employee dashboard - personal view
        const userQuotations = await storage.getQuotationsByUserInDateRange(user.id, startDate, endDate);
        console.log(`Vendedor Dashboard - Found ${userQuotations.length} quotations for user ${user.name}`);
        const userCustomers = await storage.getCustomersByUser(user.id);

        const approvedQuotations = userQuotations.filter(q => q.status === 'approved');
        // REGRA: Vendedor vê apenas propostas pendentes ORIGINAIS (que ele criou, não as do admin)
        const pendingQuotations = userQuotations.filter(q => q.status === 'pending' && q.adminCalculated === 0);
        
        // REGRA VENDEDOR: Comissão baseada APENAS nas propostas originais que ELE aprovou
        // Filtrar apenas propostas originais do vendedor (não as calculadas pelo admin)
        const vendedorOriginalApproved = approvedQuotations.filter(q => q.adminCalculated === 0);
        console.log(`Vendedor Dashboard - Total quotations: ${userQuotations.length}, Approved: ${approvedQuotations.length}, Original approved: ${vendedorOriginalApproved.length}`);

        // REGRA: Taxa de conversão baseada apenas nas propostas originais do vendedor
        const originalQuotations = userQuotations.filter(q => q.adminCalculated === 0);
        const conversionRate = originalQuotations.length > 0 
          ? (vendedorOriginalApproved.length / originalQuotations.length) * 100 
          : 0;
        
        const commissionPercent = parseFloat(user.commissionPercent || '0');
        const totalCommission = vendedorOriginalApproved.reduce((sum, q) => {
          return sum + (parseFloat(q.total) * commissionPercent / 100);
        }, 0);

        // Vendas totais = valor bruto das propostas originais aprovadas pelo vendedor
        const totalSales = vendedorOriginalApproved.reduce((sum, q) => sum + parseFloat(q.total), 0);

        // Breakdown detalhado apenas das propostas originais
        const commissionBreakdown = vendedorOriginalApproved.map(q => ({
          quotationId: q.id,
          quotationNumber: q.quotationNumber,
          customerName: q.customer.name,
          quotationTotal: parseFloat(q.total),
          commissionPercent,
          commissionAmount: parseFloat(q.total) * commissionPercent / 100,
          approvedDate: q.updatedAt || q.createdAt
        }));

        console.log(`Vendedor Dashboard - Original approved: ${vendedorOriginalApproved.length}, Total sales: ${totalSales}, Commission: ${totalCommission}`);

        res.json({
          type: "employee",
          totalSales, // Vendas brutas das propostas originais aprovadas
          totalCommission, // Comissão das propostas originais
          pendingQuotations: pendingQuotations.length,
          activeCustomers: userCustomers.length,
          conversionRate,
          approvedQuotations: vendedorOriginalApproved.length, // Apenas propostas originais aprovadas
          totalQuotations: originalQuotations.length, // Apenas propostas originais
          commissionPercent,
          commissionBreakdown
        });
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Recent activities endpoint
  app.get("/api/recent-activities/:date?", requireAuth, async (req, res) => {
    try {
      const user = req.session.user!;
      const selectedDate = (req.params.date as string) || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      
      const [year, month] = selectedDate.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      let quotations: any[];

      if (user.type === "admin") {
        // Admin sees all employee activities
        quotations = await storage.getQuotationsInDateRange(startDate, endDate);
      } else {
        // REGRA: Vendedor vê apenas suas propostas ORIGINAIS (não as calculadas pelo admin)
        const allUserQuotations = await storage.getQuotationsByUserInDateRange(user.id, startDate, endDate);
        quotations = allUserQuotations.filter(q => q.adminCalculated === 0);
        console.log(`Recent Activities - User ${user.name}: found ${allUserQuotations.length} total, showing ${quotations.length} originals`);
      }

      const activities = quotations
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10)
        .map(q => ({
          id: q.id,
          customerName: q.customer?.name || 'Cliente não encontrado',
          sellerName: q.user?.name || 'Vendedor não encontrado',
          description: `Proposta ${q.quotationNumber}`,
          total: q.total,
          status: q.status,
          createdAt: q.createdAt
        }));

      res.json(activities);
    } catch (error) {
      console.error("Error fetching recent activities:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Generate monthly extract (PDF/Excel)
  app.get("/api/extract/:format/:date?", requireAuth, async (req, res) => {
    try {
      const user = req.session.user!;
      const format = req.params.format; // 'pdf' or 'excel'
      const selectedDate = (req.params.date as string) || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      
      const [year, month] = selectedDate.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const monthName = startDate.toLocaleDateString('pt-BR', { year: 'numeric', month: 'long' });

      if (format === 'pdf') {
        // For now, return JSON that can be used to generate PDF on frontend
        if (user.type === "admin") {
          const allQuotations = await storage.getQuotationsInDateRange(startDate, endDate);
          const allUsers = await storage.getUsers();
          const employees = allUsers.filter(u => u.type === "vendedor");
          
          const approvedQuotations = allQuotations.filter(q => q.status === 'approved');
          const totalRevenue = approvedQuotations.reduce((sum, q) => sum + parseFloat(q.total), 0);
          
          const commissionsByEmployee = employees.map(employee => {
            const employeeApprovedQuotations = approvedQuotations.filter(q => q.userId === employee.id);
            const commissionPercent = parseFloat(employee.commissionPercent || '0');
            const totalSales = employeeApprovedQuotations.reduce((sum, q) => sum + parseFloat(q.total), 0);
            const totalCommission = totalSales * commissionPercent / 100;
            
            return {
              employeeName: employee.name,
              employeeBranch: employee.branch,
              commissionPercent,
              totalSales,
              totalCommission,
              quotationsCount: employeeApprovedQuotations.length
            };
          });

          const totalCommissionsPaid = commissionsByEmployee.reduce((sum, emp) => sum + emp.totalCommission, 0);
          
          res.json({
            type: 'admin',
            monthName,
            totalRevenue,
            totalCommissionsPaid,
            netProfit: totalRevenue - totalCommissionsPaid,
            commissionsByEmployee,
            approvedQuotationsCount: approvedQuotations.length,
            totalQuotationsCount: allQuotations.length
          });
        } else {
          const userQuotations = await storage.getQuotationsByUserInDateRange(user.id, startDate, endDate);
          const approvedQuotations = userQuotations.filter(q => q.status === 'approved');
          const commissionPercent = parseFloat(user.commissionPercent || '0');
          
          const commissionBreakdown = approvedQuotations.map(q => ({
            quotationNumber: q.quotationNumber,
            customerName: q.customer.name,
            quotationTotal: parseFloat(q.total),
            commissionAmount: parseFloat(q.total) * commissionPercent / 100,
            approvedDate: new Date(q.updatedAt || q.createdAt).toLocaleDateString('pt-BR')
          }));

          const totalCommission = commissionBreakdown.reduce((sum, item) => sum + item.commissionAmount, 0);
          
          res.json({
            type: 'employee',
            employeeName: user.name,
            employeeBranch: user.branch,
            monthName,
            commissionPercent,
            totalCommission,
            commissionBreakdown,
            approvedQuotationsCount: approvedQuotations.length,
            totalQuotationsCount: userQuotations.length
          });
        }
      } else {
        res.status(400).json({ message: "Format not supported yet" });
      }
    } catch (error) {
      console.error("Error generating extract:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
