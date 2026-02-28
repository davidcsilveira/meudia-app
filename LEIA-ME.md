# 📱 MeuDia PWA — Como Instalar no Celular

## O que é um PWA?
Um **Progressive Web App (PWA)** funciona como um app nativo instalado no celular, mas é baseado na web. Você abre pelo navegador e instala na tela inicial!

---

## ✅ Pré-requisito: Hospedar os arquivos

Os arquivos precisam estar acessíveis por um servidor web (não funcionam abrindo direto pelo arquivo local no celular). Opções gratuitas e fáceis:

---

## 🚀 Opção 1 — GitHub Pages (RECOMENDADO, grátis)

1. Crie uma conta em [github.com](https://github.com)
2. Crie um repositório novo (ex: `meudia-app`)
3. Faça upload de **todos** os arquivos desta pasta + a pasta `icons/`
4. Vá em **Settings → Pages → Source: main branch → /root**
5. Aguarde ~1 min e acesse: `https://seu-usuario.github.io/meudia-app`
6. No celular, abra esse link no Chrome (Android) ou Safari (iPhone)
7. Toque em **"Adicionar à tela inicial"** ou no banner que aparecer

---

## 🚀 Opção 2 — Netlify Drop (mais fácil, grátis)

1. Acesse [app.netlify.com/drop](https://app.netlify.com/drop)
2. Arraste a pasta inteira dos arquivos para a página
3. Aguarde o upload — você receberá um link automático
4. Acesse o link no celular e instale!

---

## 🚀 Opção 3 — Servidor local (para testar no PC)

```bash
# Com Python (já vem no Mac/Linux)
cd pasta-do-projeto
python3 -m http.server 8080

# Com Node.js
npx serve .
```
Acesse `http://localhost:8080` no navegador.

---

## 📲 Como instalar no celular

### Android (Chrome)
1. Abra o site no Chrome
2. Um banner "Instalar MeuDia" aparecerá automaticamente, OU
3. Toque nos 3 pontinhos (⋮) → "Adicionar à tela inicial"

### iPhone/iPad (Safari)
1. Abra o site no Safari
2. Toque no botão de compartilhar (□↑)
3. Role e toque em **"Adicionar à Tela Inicial"**
4. Confirme tocando em "Adicionar"

---

## 📁 Estrutura dos arquivos

```
meudia-app/
├── index.html        ← Página principal
├── style.css         ← Estilos
├── app.js            ← Lógica do app
├── sw.js             ← Service Worker (offline)
├── manifest.json     ← Configurações do PWA
├── offline.html      ← Página offline
└── icons/
    ├── icon-72.png
    ├── icon-96.png
    ├── icon-128.png
    ├── icon-144.png
    ├── icon-152.png
    ├── icon-192.png
    ├── icon-384.png
    └── icon-512.png
```

---

## ✨ Funcionalidades do App

- 📋 **Atividades** — adicionar, editar, concluir tarefas com anel de progresso
- 💰 **Financeiro** — controle de receitas e despesas com gráfico
- 🛒 **Compras** — lista do supermercado com preço estimado
- 🔔 **Notificações** — lembretes de atividades (opcional)
- 📴 **Offline** — funciona sem internet após instalação
- 💾 **Dados salvos** — tudo fica salvo no próprio dispositivo
- 📳 **Haptic feedback** — vibração ao interagir (Android)
