# Guia de Deploy na Vercel - MasterGreen

## 📋 Pré-requisitos

1. **Conta na Vercel**: Crie uma conta gratuita em https://vercel.com
2. **Conta no GitHub**: Você precisa do código no GitHub para conectar com a Vercel
3. **Database PostgreSQL**: Configure um banco PostgreSQL online (recomendado: Neon, Supabase ou Railway)

## 🚀 Passo a Passo

### 1. Preparar o Banco de Dados

Você precisa de um banco PostgreSQL online. Recomendo usar o **Neon** (gratuito):

1. Acesse https://neon.tech
2. Crie uma conta e um novo projeto
3. Copie a CONNECTION STRING que será algo como:
   ```
   postgresql://username:password@host:5432/database?sslmode=require
   ```

### 2. Configurar as Variáveis de Ambiente na Vercel

No painel da Vercel, vá em **Settings > Environment Variables** e adicione:

```
DATABASE_URL=postgresql://sua_string_de_conexao_aqui
NODE_ENV=production
SESSION_SECRET=uma_string_secreta_aleatoria_qualquer
```

### 3. Configurações do Projeto

Os arquivos já estão configurados:
- ✅ `vercel.json` - Configuração da Vercel
- ✅ `package.json` - Scripts de build
- ✅ `drizzle.config.ts` - Configuração do banco

### 4. Deploy na Vercel

1. **Via GitHub** (Recomendado):
   - Conecte seu repositório GitHub à Vercel
   - A Vercel detectará automaticamente as configurações
   - Cada push para main/master fará deploy automático

2. **Via Vercel CLI**:
   ```bash
   npm i -g vercel
   vercel login
   vercel --prod
   ```

### 5. Configurar o Banco de Dados

Após o primeiro deploy, execute as migrações:

1. No terminal local ou na Vercel, execute:
   ```bash
   npm run db:push
   ```

2. Ou conecte diretamente ao banco e execute o SQL de criação das tabelas.

## 📊 Estrutura de Tabelas

O sistema precisa das seguintes tabelas (execute no seu banco PostgreSQL):

```sql
-- Usuários
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

-- Clientes
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  created_by_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Produtos
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price_per_sqm NUMERIC NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Custos
CREATE TABLE costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price_per_sqm NUMERIC NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Orçamentos
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

-- Itens do orçamento
CREATE TABLE quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Custos do orçamento
CREATE TABLE quotation_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
  cost_id UUID REFERENCES costs(id),
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🎯 Dados Iniciais

Execute estes comandos para adicionar os produtos e custos padrão:

```sql
-- Produtos padrão
INSERT INTO products (name, price_per_sqm, description) VALUES
('Grama Sintética', 64.00, 'Grama sintética de alta qualidade'),
('Capacho Vinil', 55.00, 'Capacho de vinil resistente'),
('Piso Tátil', 52.00, 'Piso tátil para acessibilidade');

-- Custos padrão
INSERT INTO costs (name, price_per_sqm, description) VALUES
('Material Base', 15.00, 'Custo base do material'),
('Mão de Obra', 12.00, 'Custo de instalação'),
('Transporte', 8.00, 'Custo de entrega'),
('Ferramentas', 5.00, 'Desgaste de ferramentas');

-- Usuário administrador
INSERT INTO users (name, email, password, type, branch, commission_percent) VALUES
('Newton Rocha', 'mastergreendf@gmail.com', 'newton1901', 'admin', 'Ceilândia', '0');
```

## ✅ Verificação Final

Após o deploy, teste:

1. **Login**: Acesse a aplicação e faça login
2. **Navegação**: Teste todas as páginas
3. **Banco de Dados**: Verifique se os dados são salvos
4. **Responsividade**: Teste no mobile

## 🔧 Solução de Problemas

### Build Error
- Verifique se todas as dependências estão no `package.json`
- Confirme se o `vercel.json` está correto

### Database Error
- Verifique a CONNECTION STRING
- Confirme se as tabelas foram criadas
- Teste a conexão localmente primeiro

### Environment Variables
- Certifique-se de que todas as variáveis estão configuradas na Vercel
- Confirme se não há espaços ou caracteres especiais

## 📞 Suporte

Se tiver problemas:
1. Verifique os logs na Vercel
2. Teste localmente primeiro
3. Confirme todas as variáveis de ambiente
4. Verifique a conexão com o banco de dados

---

**Domínio**: Após o deploy, sua aplicação ficará disponível em `https://seu-projeto.vercel.app`