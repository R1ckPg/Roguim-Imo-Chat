# Roguim Imobiliaria - Chat Interno

Um sistema de chat interno para a Roguim Imobiliaria com interface similar ao WhatsApp.

## Funcionalidades

### Usuários Normais
- Acesso a chats privados com outros usuários
- Participação em chats de grupo
- Envio de mensagens de texto, imagens e arquivos
- Edição e exclusão de mensagens próprias
- Acesso apenas a conversas das quais são participantes

### Administradores
- Criação de novos usuários e administradores
- Definição de nome completo, usuário e senha temporária
- Exclusão de usuários existentes
- Criação e gerenciamento de grupos
- Envio de alertas ou avisos aos usuários

### Sistema de Mensagens
- Suporte a conversas privadas e em grupo
- Mensagens com texto, imagens e arquivos
- Imagens exibidas diretamente no chat
- Arquivos disponíveis para download
- Timestamps em todas as mensagens

### Grupos
- Grupos criados por administradores
- Grupos podem conter múltiplos usuários
- Chats de grupo seguem as mesmas regras dos chats privados
- Apenas administradores podem gerenciar membros do grupo

### Notificações
- Notificações para novas mensagens
- Indicadores de mensagens não lidas
- Status online dos usuários
- Indicador de digitação
- Status de visualização das mensagens

### Privacidade e Segurança
- Autenticação obrigatória
- Acesso apenas a chats e grupos dos quais o usuário faz parte
- Logs de ações administrativas

## Instalação e Execução

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Execute o servidor:
   ```bash
   npm start
   ```

3. Abra o navegador em `http://localhost:3000`

## Usuário Padrão

- **Usuário:** admin
- **Senha:** admin123
- **Função:** Administrador

## Estrutura do Projeto

```
chat interno/
├── server.js          # Servidor Node.js com Express e Socket.io
├── package.json       # Dependências do projeto
├── public/
│   ├── index.html     # Interface do chat
│   ├── style.css      # Estilos CSS
│   ├── app.js         # Lógica do cliente
│   └── uploads/       # Diretório para arquivos enviados
└── chat.db           # Banco de dados SQLite (criado automaticamente)
```

## Tecnologias Utilizadas

- **Backend:** Node.js, Express.js, Socket.io
- **Frontend:** HTML5, CSS3, JavaScript (ES6+)
- **Banco de Dados:** SQLite3
- **Autenticação:** JWT (JSON Web Tokens)
- **Tempo Real:** WebSocket via Socket.io
- **Upload de Arquivos:** Multer

## API Endpoints

### Autenticação
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Registro (apenas admin)

### Usuários
- `GET /api/users` - Listar usuários
- `DELETE /api/users/:id` - Excluir usuário (apenas admin)

### Grupos
- `GET /api/groups` - Listar grupos
- `POST /api/groups` - Criar grupo (apenas admin)
- `POST /api/groups/:id/members` - Adicionar membro ao grupo (apenas admin)

### Mensagens
- `GET /api/messages/:conversationId` - Buscar mensagens
- `PUT /api/messages/:id` - Editar mensagem (apenas própria)
- `DELETE /api/messages/:id` - Excluir mensagem (apenas própria)

### Upload
- `POST /api/upload` - Upload de arquivo

## Desenvolvimento

Para desenvolvimento com recarregamento automático:
```bash
npm run dev
```

## Segurança

- Senhas criptografadas com bcrypt
- Tokens JWT para autenticação
- Validação de tipos de arquivo no upload
- Limite de tamanho de arquivo (10MB)
- Controle de acesso baseado em roles

## Próximas Melhorias

- Implementar status online/offline
- Adicionar notificações push
- Melhorar interface responsiva
- Adicionar pesquisa avançada
- Implementar backup do banco de dados
- Adicionar logs detalhados de auditoria