-- MasterGreen Database Setup for Production

-- Create tables
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('admin', 'employee')),
  branch TEXT NOT NULL,
  commission_percent TEXT NOT NULL DEFAULT '0',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  created_by_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price_per_sqm NUMERIC NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price_per_sqm NUMERIC NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_number TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id),
  created_by_id UUID REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  total NUMERIC NOT NULL,
  discount_percent NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  observations TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE quotation_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
  cost_id UUID REFERENCES costs(id),
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert initial data
INSERT INTO products (name, price_per_sqm, description) VALUES
('Grama Sintética', 64.00, 'Grama sintética de alta qualidade'),
('Capacho Vinil', 55.00, 'Capacho de vinil resistente'),
('Piso Tátil', 52.00, 'Piso tátil para acessibilidade');

INSERT INTO costs (name, price_per_sqm, description) VALUES
('Material Base', 15.00, 'Custo base do material'),
('Mão de Obra', 12.00, 'Custo de instalação'),
('Transporte', 8.00, 'Custo de entrega'),
('Ferramentas', 5.00, 'Desgaste de ferramentas');

INSERT INTO users (name, email, password, type, branch, commission_percent) VALUES
('Newton Rocha', 'mastergreendf@gmail.com', 'newton1901', 'admin', 'Ceilândia', '0');