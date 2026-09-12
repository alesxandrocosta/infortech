# 🚀 TechFlow ERP - Sistema de Gerenciamento de Ordens de Serviço

## 📋 Visão Geral

TechFlow ERP é um sistema completo de gerenciamento de ordens de serviço para assistência técnica, desenvolvido em:
- **Backend:** Node.js + Express + MySQL
- **Frontend:** React + Vite + Tailwind CSS

---

## 🔧 Pré-requisitos

### Obrigatório:
1. **MySQL 8.0+** instalado e em execução na porta **3306**
2. **Node.js 18.0+** e **npm 9.0+**
3. Variáveis de ambiente configuradas

### Usuário MySQL padrão:
```
Usuário: root
Senha: 46302113
Porta: 3306
```

---

## 📦 Estrutura do Projeto

```
infortec/
├── backend/                 # Servidor Node.js + Express
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js  # Configuração MySQL
│   │   ├── controllers/     # Lógica de negócio
│   │   ├── routes/          # Definição de rotas
│   │   ├── models/          # Modelos de dados
│   │   ├── middleware/      # Middlewares (auth, validação)
│   │   └── server.js        # Ponto de entrada
│   ├── scripts/
│   │   └── init-database.js # Script de inicialização do BD
│   ├── .env.example         # Variáveis de ambiente
│   └── package.json
├── frontend/                # Aplicação React + Vite
│   ├── src/
│   │   ├── pages/           # Páginas da aplicação
│   │   ├── components/      # Componentes React
│   │   ├── services/        # Chamadas à API
│   │   ├── hooks/           # Custom hooks
│   │   └── App.jsx          # Entrada da aplicação
│   ├── .env.example
│   └── package.json
├── database/
│   └── init.sql             # Script SQL completo
└── docs/
    └── DOCUMENTACAO_2.md    # Documentação detalhada
```

---

## ⚡ Guia de Configuração Rápida

### Executar o sistema com um único comando

Na raiz do projeto, instale todas as dependências uma vez e inicie backend e frontend juntos:

```bash
npm run install:all
npm run dev
```

O frontend ficará disponível em `http://0.0.0.0:5173/` e a API em `http://localhost:5000`.
Para encerrar os dois serviços, pressione `Ctrl+C` no mesmo terminal.

### Cadastro e avisos por WhatsApp Web

O cadastro de clientes possui telefone, WhatsApp, CEP, número da casa e endereço. O CEP é consultado automaticamente pelo ViaCEP.
Para aplicar os novos campos em um banco existente, execute `npm run init-db` no diretório raiz.

As atualizações de status da OS podem ser enviadas pela sessão do WhatsApp Web da máquina. Na primeira execução, o backend abrirá uma janela do WhatsApp Web e exibirá um QR Code no terminal caso ainda não exista uma sessão vinculada:

```env
WHATSAPP_WEB_HEADLESS=false
```

Após o primeiro vínculo, a sessão fica salva em `backend/.wwebjs_auth` e será reutilizada nos próximos inícios. Sem uma sessão pronta ou sem telefone no cadastro, a OS continua sendo atualizada normalmente e o envio é ignorado.

### Reiniciar com um único comando

Para encerrar automaticamente processos antigos nas portas do sistema e iniciar backend e frontend novamente:

```bash
npm run restart
```

Esse comando não solicita confirmação e encerra somente os processos que estiverem usando as portas `5000` e `5173`.

### Passo 1: Clonar e Entrar no Diretório

```bash
cd c:\infortec\backend
```

### Passo 2: Configurar Variáveis de Ambiente

Copie `.env.example` para `.env`:

```bash
cp .env.example .env
```

Edite o arquivo `.env` se necessário (as configurações padrão já estão corretas).

### Passo 3: Instalar Dependências

```bash
npm install
```

### Passo 4: Inicializar Banco de Dados

```bash
npm run init-db
```

Este script vai:
- ✓ Verificar conexão com MySQL
- ✓ Criar o banco `bd_infortec` (se não existir)
- ✓ Criar todas as 16 tabelas (com estrutura completa)
- ✓ Inserir dados de exemplo
- ✓ Validar a estrutura final

**Saída esperada:**
```
✨ Banco de dados inicializado com sucesso!

🚀 Próximos passos:
   1. npm install (no diretório backend) ✓ Já realizado
   2. npm run dev (para iniciar o servidor)
```

### Passo 5: Iniciar o Servidor

**Modo desenvolvimento (com hot-reload):**
```bash
npm run dev
```

**Modo produção:**
```bash
npm start
```

O servidor estará disponível em: `http://localhost:5000`

---

## 📊 Tabelas do Banco de Dados (16 tabelas)

| # | Tabela | Descrição |
|---|--------|-----------|
| 1 | `users` | Usuários do sistema com roles (admin, gerente, etc.) |
| 2 | `customers` | Cadastro de clientes (PF/PJ) |
| 3 | `services` | Catálogo de serviços disponíveis |
| 4 | `product_parts` | Peças do estoque |
| 5 | `kits` | Kits de peças |
| 6 | `kit_items` | Itens que compõem os kits |
| 7 | `service_orders` | Ordens de serviço (OS) |
| 8 | `os_checklists` | Checklist por OS |
| 9 | `os_items` | Peças/Kits associados à OS |
| 10 | `os_services` | Serviços associados à OS |
| 11 | `os_medias` | Fotos/mídia das OS |
| 12 | `os_status_histories` | Histórico de mudanças de status |
| 13 | `payments` | Pagamentos das OS |
| 14 | `physical_inventories` | Inventários físicos |
| 15 | `physical_inventory_items` | Itens de cada inventário |
| 16 | `sequence_counters` | Contador para protocolo sequencial |

---

## 🔐 Autenticação e Perfis

### Usuário Admin Padrão
```
Email: admin@techflow.com
Senha: admin123 (hash bcrypt pré-configurado)
Perfil: admin
```

### Perfis Disponíveis (RBAC)
- **admin** - Acesso total ao sistema
- **gerente** - Gerenciamento de OS e equipe
- **administrativo** - Gestão administrativa
- **atendente** - Abertura e acompanhamento de OS
- **tecnico** - Execução de serviços

---

## 📝 Regras de Negócio Implementadas

### Protocolo Sequencial
- Formato: `OS-00001`, `OS-00002`, etc.
- Geração automática via Stored Procedure
- Incremento gerenciado pela tabela `sequence_counters`

### Cálculo de Valores da OS
```
valor_servico = ∑(os_services.preco × quantidade)
soma_itens = ∑(os_items.valor_unitario × quantidade)
valor_total = valor_servico + soma_itens

SE status = 'Desistência do Cliente':
  valor_total = valor_servico (sem cobrança de peças)
```

### Controle de Estoque
- **Vincular peça:** Verifica disponibilidade e debita automaticamente
- **Vincular kit:** Busca peças componentes em `kit_items` e debita individualmente
- **Inventário físico:** Atualiza quantidade_estoque apenas se houver divergência

### Status do Cliente (Inadimplência)
```
SE existe OS concluída/entregue com saldo pendente:
  customers.status = 'Inadimplente'
SENÃO:
  customers.status = 'Adimplente'
```

---

## 🛠️ Estrutura de Variáveis de Ambiente

```env
# Banco de Dados MySQL
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=46302113
DB_PORT=3386
DB_NAME=bd_infortec

# Servidor
NODE_ENV=development
PORT=5000

# JWT
JWT_SECRET=techflow_secret_key_2024_change_in_production
JWT_EXPIRY=7d

# CORS
CORS_ORIGIN=http://0.0.0.0:5173

# Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
```

---

## 🔍 Verificar Status da Conexão

Para testar a conexão com o banco:

```bash
npm run dev
```

Se bem-sucedido, você verá:
```
✓ Conexão com MySQL estabelecida com sucesso
Server running on port 5000
```

---

## 📚 Próximos Passos

1. ✓ **Fase 1: Configuração de Banco de Dados** (Concluída)
2. **Fase 2: Implementar Controllers e Rotas**
3. **Fase 3: Autenticação JWT e RBAC**
4. **Fase 4: Frontend React + Vite**
5. **Fase 5: Integração e Testes**

---

## 🆘 Troubleshooting

### Erro: "ECONNREFUSED - Connection refused"
```
Solução: Verificar se MySQL está rodando na porta 3386
```

### Erro: "Access denied for user 'root'"
```
Solução: Verificar credenciais no .env
```

### Erro: "Database 'bd_infortec' does not exist"
```
Solução: Executar npm run init-db novamente
```

### Erro: "Table already exists"
```
Solução: Normal - o script verifica e não recria tabelas existentes
```

---

## 📞 Suporte

Para dúvidas ou problemas, consulte a documentação completa em `docs/DOCUMENTACAO_2.md`

---

**Versão:** 1.0.0  
**Atualizado:** 2026-09-01  
**Autor:** Infortec Soluções em TI
