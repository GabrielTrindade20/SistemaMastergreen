# MasterGreen - Sistema de Gestão

## Overview

MasterGreen is a full-stack business management system for a company specializing in synthetic grass, vinyl mats, and tactile flooring. The application is built as a Single Page Application (SPA) with a modern React frontend and Express.js backend, designed to handle quotations, customer management, reporting, and WhatsApp integration.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon serverless PostgreSQL
- **API Design**: RESTful API with JSON responses
- **File Processing**: PDF generation with jsPDF library

### Design System
- **Brand Colors**: 
  - Primary Green: `#002b17` (hsl(145, 100%, 8%))
  - Black: `#000000`
  - White: `#ffffff`
- **Typography**: System fonts with 16px+ base sizes for accessibility
- **Layout**: Responsive design with 12px border radius and card-based layouts

## Key Components

### Database Schema
- **Customers**: Complete customer information including contact details and addresses
- **Products**: Product catalog with pricing per square meter
- **Quotations**: Main quotation records with status tracking
- **Quotation Items**: Line items linking products to quotations with quantities

### Core Modules

1. **Customer Management** (`/clientes`)
   - CRUD operations for customer data
   - Search and filtering capabilities
   - Customer profile management

2. **Quotation System** (`/orcamentos`)
   - Multi-product quotation creation
   - Automatic calculations (subtotal, 10% tax, total)
   - Status tracking (pending, approved, rejected)
   - PDF generation for proposals

3. **Dashboard** (`/dashboard`)
   - Business metrics overview
   - Revenue tracking and conversion rates
   - Recent activity feed

4. **Reports** (`/relatorios`)
   - Financial analysis and profit calculations
   - Product performance metrics
   - Export capabilities

5. **WhatsApp Integration** (`/whatsapp`)
   - Automated response configuration
   - Message template management
   - Contact number management

## Data Flow

### Quotation Creation Process
1. User selects customer from dropdown or creates new customer
2. User adds products with quantities (in square meters)
3. System calculates pricing based on product rates:
   - Grama Sintética: R$ 64,00/m²
   - Capacho Vinil: R$ 55,00/m²
   - Piso Tátil: R$ 52,00/m²
4. System applies 10% tax and calculates total
5. Generated quotation includes 7-day validity period
6. PDF can be generated with company branding

### API Structure
- `GET/POST /api/customers` - Customer management
- `GET/POST /api/quotations` - Quotation operations
- `GET /api/products` - Product catalog
- RESTful conventions with JSON responses

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: Serverless PostgreSQL connection
- **drizzle-orm**: Type-safe database operations
- **@tanstack/react-query**: Server state management
- **react-hook-form**: Form handling and validation
- **jspdf**: PDF generation for quotations
- **wouter**: Lightweight React routing

### UI Dependencies
- **@radix-ui/***: Accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **lucide-react**: Modern icon library
- **class-variance-authority**: Variant-based component styling

### Development Dependencies
- **TypeScript**: Type safety across the stack
- **Vite**: Build tool and development server
- **ESBuild**: Backend bundling for production

## Deployment Strategy

### Development Environment
- Vite dev server for frontend with HMR
- Express server with automatic restarts
- Database migrations with Drizzle Kit
- Replit integration with development banner

### Production Build
- Frontend: Vite builds to `dist/public`
- Backend: ESBuild bundles server to `dist/index.js`
- Single deployment package with static file serving
- Environment variables for database connection

### Database Management
- Drizzle migrations in `/migrations` directory
- Schema definitions in `/shared/schema.ts`
- Database initialization with default products
- Connection pooling with Neon serverless

### File Structure
```
/client - React frontend application
/server - Express backend API
/shared - Shared types and schemas
/migrations - Database migration files
```

The application follows a monorepo structure with clear separation between frontend, backend, and shared code, enabling efficient development and deployment workflows.