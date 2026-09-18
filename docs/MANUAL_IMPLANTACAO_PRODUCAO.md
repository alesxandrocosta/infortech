# Manual de Implantacao em Producao

Este manual descreve a implantacao do TechFlow ERP em Windows Server ou Windows 10/11, usando Node.js, MySQL e IIS. O repositorio oficial e:

`https://github.com/alesxandrocosta/infortech.git`

## 1. Arquitetura recomendada

- MySQL 8.0+: banco de dados, preferencialmente no mesmo servidor ou em uma rede privada.
- Node.js LTS 18 ou superior: executa a API na porta interna `5000`.
- IIS: publica o frontend compilado e termina HTTPS.
- URL publica: o frontend pode estar em `https://erp.seudominio.com` e a API em `https://api.seudominio.com`.
- Firewall: exponha somente `80/443`; mantenha a porta `5000` acessivel apenas localmente e a porta `3306` restrita ao servidor da API.

Nao use as senhas presentes em exemplos, documentacao antiga ou backups. Gere credenciais novas para cada ambiente.

## 2. Pre-requisitos do servidor

Instale e valide:

1. Git para Windows.
2. Node.js LTS 18 ou superior, com npm 9 ou superior.
3. MySQL Server 8.0 ou superior e os comandos `mysql` e `mysqldump` no PATH.
4. IIS com o recurso de arquivos estaticos. Para proxy reverso, instale tambem URL Rewrite e Application Request Routing.
5. Um certificado TLS valido para o dominio.

No PowerShell, confirme:

```powershell
git --version
node --version
npm --version
mysql --version
mysqldump --version
```

## 3. Baixar a versao do GitHub

Abra o PowerShell como usuario de implantacao e execute:

```powershell
New-Item -ItemType Directory -Force C:\Apps | Out-Null
Set-Location C:\Apps
git clone https://github.com/alesxandrocosta/infortech.git infortec
Set-Location C:\Apps\infortec
git checkout master
git pull --ff-only origin master
```

Para implantacoes controladas, substitua `master` por uma tag ou commit previamente homologado.

## 4. Instalar as dependencias

Execute o instalador versionado:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
npm run install:windows
```

O script valida Node/npm, executa `npm ci` na raiz, backend e frontend e cria `backend\.env` somente se ele nao existir. Ele nunca sobrescreve um `.env` existente.

## 5. Configurar o ambiente do backend

Edite `C:\Apps\infortec\backend\.env`. Em producao, use valores reais e fortes:

```dotenv
NODE_ENV=production
PORT=5000
DB_HOST=127.0.0.1
DB_USER=infortec_app
DB_PASSWORD=senha-forte-e-unica
DB_PORT=3306
DB_NAME=bd_infortec
JWT_SECRET=segredo-aleatorio-com-no-minimo-32-caracteres
JWT_EXPIRY=7d
CORS_ORIGIN=https://erp.seudominio.com
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
SALES_TAX_RATE=0.0865
TZ=America/Sao_Paulo
```

Regras obrigatorias:

- `JWT_SECRET` deve ser aleatorio e exclusivo.
- `CORS_ORIGIN` deve conter somente as origens reais, separadas por virgula quando necessario.
- Nao coloque `backend\.env` no Git.
- O usuario do banco da aplicacao nao deve ser `root`.

## 6. Criar banco e usuario MySQL

Entre no MySQL com uma conta administrativa. Troque a senha antes de executar:

```sql
CREATE DATABASE IF NOT EXISTS bd_infortec
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'infortec_app'@'127.0.0.1'
  IDENTIFIED BY 'senha-forte-e-unica';

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES,
      EXECUTE ON bd_infortec.* TO 'infortec_app'@'127.0.0.1';
FLUSH PRIVILEGES;
```

Se o MySQL estiver em outro servidor, substitua `127.0.0.1` pelo IP privado da API e restrinja o firewall a esse IP.

## 7. Criar tabelas e aplicar o schema

Com o `.env` configurado, execute:

```powershell
Set-Location C:\Apps\infortec
npm run init-db
```

Esse comando cria/verifica o banco e as tabelas-base. Para uma instalacao limpa que tambem aplica todas as migracoes SQL versionadas, use o script de importacao:

```powershell
npm run db:import
```

O script exige `mysql` e `mysqldump` no PATH, aplica `database\init.sql` e as migracoes em ordem e salva uma copia do schema em `backend\backups`. Valide o resultado:

```powershell
mysql -u infortec_app -p -e "USE bd_infortec; SHOW TABLES;"
```

Em banco ja existente, faca backup antes de aplicar migracoes. Nunca aplique `DROP`, `TRUNCATE` ou alteracoes destrutivas sem backup e aprovacao.

## 8. Criar o administrador de producao

Preencha temporariamente no `backend\.env`:

```dotenv
ADMIN_FULL_NAME=Administrador Principal
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@seudominio.com
ADMIN_PHONE=
ADMIN_BRAND=Sua Empresa
ADMIN_PASSWORD=senha-forte-com-no-minimo-11-caracteres
```

Execute uma unica vez:

```powershell
npm run create-admin --prefix backend
```

Depois remova `ADMIN_PASSWORD` e os demais campos `ADMIN_*` do `.env`, ou substitua-os por valores vazios. O sistema usa `password_hash`; a senha nao e armazenada em texto puro.

## 9. Compilar e publicar o frontend

Defina a URL publica da API antes do build:

```powershell
$env:VITE_API_URL = 'https://api.seudominio.com'
npm run build --prefix frontend
```

Publique o conteudo de `C:\Apps\infortec\frontend\dist` no site do IIS. Nao publique o diretorio `src`, arquivos `.env` ou `node_modules`.

No IIS, configure fallback de SPA para `index.html` e HTTPS. O valor de `VITE_API_URL` e incorporado no build; depois de altera-lo, gere o build novamente.

## 10. Executar a API em producao

Teste primeiro em PowerShell:

```powershell
Set-Location C:\Apps\infortec\backend
npm start
```

Em producao, registre `C:\Apps\infortec\backend\src\server.js` como servico do Windows usando uma ferramenta de gerenciamento de servicos, como NSSM. Configure:

- Application: caminho completo de `node.exe`.
- Arguments: `C:\Apps\infortec\backend\src\server.js`.
- Startup directory: `C:\Apps\infortec\backend`.
- Environment: variaveis do `backend\.env`.
- Restart: reiniciar o processo em falha.
- Logs: gravar stdout/stderr em diretorio fora do Git.

Nao use `npm run dev` em producao, pois ele inicia o nodemon. O comando de producao e `npm start`.

## 11. Validacao pos-implantacao

Execute os testes abaixo:

```powershell
Invoke-WebRequest https://api.seudominio.com/api/health
npm run build --prefix frontend
npm run lint
```

Confirme no navegador:

- login do administrador;
- cadastro e consulta de cliente;
- criacao e atualizacao de ordem de servico;
- movimentacao de estoque;
- venda;
- portal do cliente;
- upload e geracao de etiquetas, quando utilizados.

Verifique tambem que o console do navegador nao mostra erros de CORS e que o backend conecta ao MySQL sem erros.

## 12. Backup e operacao

Faca backup diario do banco, retenha copias fora do servidor e teste a restauracao periodicamente:

```powershell
mysqldump --host=127.0.0.1 --user=infortec_app -p --single-transaction --routines --events bd_infortec > C:\Backups\bd_infortec.sql
```

Antes de atualizar:

1. Faca backup do banco e da pasta `backend\uploads`.
2. Pare o servico da API.
3. Baixe a versao aprovada com `git pull --ff-only`.
4. Execute `npm run install:windows`.
5. Aplique migracoes necessarias.
6. Gere o frontend novamente.
7. Inicie o servico e valide `/api/health`.

Monitore espaco em disco, logs, disponibilidade da API, falhas de conexao MySQL e erros HTTP 5xx. Nunca versionar backups, uploads, logs ou `.env`.

## Checklist final de producao

- [ ] HTTPS ativo e redirecionamento de HTTP para HTTPS.
- [ ] `NODE_ENV=production` configurado.
- [ ] `JWT_SECRET` forte e exclusivo.
- [ ] `CORS_ORIGIN` limitado ao dominio real.
- [ ] Usuario MySQL sem uso de `root` pela aplicacao.
- [ ] Banco criado, tabelas verificadas e migracoes aplicadas.
- [ ] Administrador inicial criado e credenciais temporarias removidas.
- [ ] Frontend compilado com `VITE_API_URL` de producao.
- [ ] API executando como servico com reinicio automatico.
- [ ] Portas do firewall restritas.
- [ ] Backup e restauracao testados.
- [ ] Endpoint `/api/health` respondendo.