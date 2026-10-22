# PRAES Imóveis · Controle de Vendas e Comissões

Sistema web para controlar cadastros, vendas, corpo de vendas, comissões, recebimentos e agendamentos.
Usa **Firebase** (login + banco de dados) e pode ser publicado no **GitHub Pages** (grátis).

## O que o sistema faz

| Tela | Para quê |
|---|---|
| **Painel** | VGV vendido, ticket médio, receita, comissões, pipeline, vendas por mês e por semana, ranking de corretores, pendências, próximos agendamentos |
| **Vendas** | Todos os cadastros (CV) e vendas, com filtros (status, empreendimento, diretoria, gerente, corretor, período). Abre a ficha com o corpo de vendas, a regra de taxa, o cálculo das comissões e as parcelas a receber. Exporta para Excel |
| **Funil / Pipeline** | Quadro de colunas (Cadastro › Análise › Aprovado › Reserva › Assinatura › Vendido). Arraste o card para mudar o status |
| **Agendamentos** | Calendário e lista de visitas/atendimentos. O botão "Virou cadastro/venda" cria a venda já preenchida |
| **Comissões** | Quanto cada pessoa vendeu e ganhou no período: por pessoa, por **hierarquia (diretor › gerente › corretor)**, por venda e da imobiliária por empreendimento |
| **Recebimentos** | O que a incorporadora vai pagar e quando: repasse em 30–45 dias ou ato parcelado. Marca o que já foi recebido |
| **Corretores / Equipe** | Base de corretores, gerentes e diretores, com hierarquia, metas e organograma |
| **Empreendimentos** | Lista com incorporadora e regra padrão de comissão |
| **Quadro de Taxas** | As regras da planilha (GNG, ICON, Santa Cecília, Natury, Unnia Verdá, Golani…) com % por cargo e conferência da diferença |
| **Usuários** (master) | Cria logins por **e-mail real** com foto, papel, vínculo com a pessoa do cadastro e **empreendimentos liberados** |
| **Dados (importar / zerar)** (master) | Carrega a base inicial, importa planilhas no formato BASE, faz backup, junta nomes duplicados e **zera o banco** para começar do zero |

**Relatórios:** todas as telas principais exportam em **Excel e PDF** (vendas, comissões por pessoa/hierarquia/venda/empreendimento, recebimentos, agendamentos). Em Comissões › Por pessoa há o botão **Extrato PDF** individual, para pagar cada corretor/gerente.

### Como a comissão é calculada
- **Uma venda só conta** quando o status é **CONTRATO ASSINADO** ou **VENDIDO** e o VGV está preenchido.
- A data usada é a **data da venda**. Se ela estiver vazia, o sistema usa a data do status ou a data do cadastro, e a venda aparece como "Falta data da venda".
- Cada venda tem uma **regra** do quadro de taxas. Para cada cargo, a comissão é **VGV × %**.
- Quem recebe cada cargo:
  - Corretor: o corretor da venda.
  - Gerente: o gerente ou equipe da venda.
  - Diretor de vendas: a diretoria da venda.
  - Imobiliária: PRAES.
  - Coordenador, comercial, Fábio e os demais: quem estiver preenchido na ficha da venda.
- A **receita** (o que a incorporadora paga) é **VGV × taxa anunciada**. A diferença entre a taxa e a soma dos cargos aparece para conferência.

### Quem vê o quê
| Papel | Acesso |
|---|---|
| **Master** | Tudo, incluindo usuários, importação e zerar banco |
| **Diretor** | Todas as vendas, comissões e recebimentos **dos empreendimentos liberados** |
| **Gerente** | Vendas, agendamentos e comissões em que ele ou a equipe dele aparecem, **só nos empreendimentos liberados** |
| **Corretor** | Só as próprias vendas, agendamentos e comissões, **só nos empreendimentos liberados** |

**Empreendimentos por usuário:** ao cadastrar o usuário, o master marca quais projetos ele pode acessar (ou "Todos"). Essa trava vale tanto na tela quanto no banco de dados (regras do Firestore), então ninguém consegue ver por fora o que não é dele.

## Novidades: liberação de usuários, corpo de vendas e pagamentos

**Liberação de usuários (cobrança por usuário)**
- O primeiro login do sistema vira **Administrador do sistema** (é o seu usuário, FAG).
- Quando o master (Guigão) cadastra alguém, o cadastro fica **"Aguardando liberação"** e a pessoa não consegue entrar.
- O administrador vê os pedidos em **Liberações**, clica em **Liberar** ou **Recusar** e acompanha a contagem de usuários ativos, que é a base da cobrança.
- Reativar um usuário inativo também passa pela liberação.
- Se o cadastro foi feito sem senha, o e-mail para a pessoa criar a senha é enviado no momento da liberação.

**Corpo de vendas em cada venda**
1. Escolha um **modelo** do quadro de taxas e clique em **Preencher com o modelo**. Ou monte a lista manualmente.
2. Defina a **taxa total da venda** (ex.: 7%).
3. Informe **quem recebe** e o **% sobre o VGV** de cada um.
4. O sistema calcula o valor, a **referência** (o % de cada um dividido pela taxa, que precisa somar 100%) e a diferença.

**Condição de recebimento da comissão**
- As opções são: Ato (à vista), Ato + parcelas mensais, Repasse Caixa/banco e Ato + repasse.
- O botão "Gerar parcelas" monta as parcelas com série, valor e vencimento. Depois é possível ajustar cada uma.
- Quando o dinheiro entra, marque a parcela como **recebida**, na venda ou em Recebimentos.

**Pagamentos** (só master e administrador)
- Cada parcela recebida é dividida pela referência de cada participante.
- O imposto de **14,80%** é descontado de todos. Só o administrador altera esse percentual.
- A tela mostra, por mês e por pessoa: bruto, imposto, líquido, pago e a pagar.
- Tem os botões "Marcar pago" e "Extrato PDF" de cada pessoa. A opção "Previstos" mostra o que ainda vai entrar.
- Na ficha da venda, o botão **Demonstrativo PDF** gera o mesmo quadro da planilha, com o corpo de vendas, a referência e as parcelas com o líquido já descontado.

---

## Testar agora (modo demonstração)
Enquanto o Firebase não estiver configurado, o sistema roda em **modo demonstração**: os dados ficam salvos só no seu navegador.
Abra o `index.html` por um servidor local (no VS Code, use a extensão *Live Server*) e entre com:
`guigao@exemplo.com` / `123456` (master). Também existem `fag@exemplo.com` (administrador do sistema), `servantes@exemplo.com` (gerente, só Unnia Verdá) e `selenna@exemplo.com` (corretor, só Unnia Verdá), todos com a mesma senha.

---

## Colocar no ar: passo a passo

### 1. Criar o projeto no Firebase
1. Acesse https://console.firebase.google.com e clique em **Adicionar projeto**. Sugestão de nome: `praes-vendas`.
2. Abra **Criação › Authentication › Começar** e, em **Método de login**, ative **E-mail/senha**.
3. Abra **Criação › Firestore Database › Criar banco de dados**. Escolha o **modo produção** e o local **southamerica-east1 (São Paulo)**.
4. Na aba **Regras** do Firestore, apague o que estiver lá, cole todo o conteúdo do arquivo `firestore.rules` e clique em **Publicar**.
   - Índices: quando um gerente/corretor com empreendimentos restritos entrar pela primeira vez, o Firestore pode mostrar no console do navegador um link "create index". Basta clicar e criar (ou usar `firebase deploy --only firestore:indexes` com o arquivo `firestore.indexes.json`).
   - E-mail de "Esqueci minha senha": em **Authentication › Modelos › Redefinição de senha**, troque o idioma para **Português (Brasil)** e, se quiser, o nome do remetente para "PRAES Imóveis".
5. Vá em **Configurações do projeto** (engrenagem) › **Seus apps** › ícone **Web `</>`**. Registre o app, sem ativar o Hosting.
6. Copie o bloco `firebaseConfig` que aparecer e cole no arquivo **`js/firebase-config.js`**, substituindo os valores de exemplo.

### 2. Criar o primeiro usuário (master)
1. Em **Authentication › Usuários › Adicionar usuário**, informe o **seu e-mail real** e uma senha (mínimo 6 caracteres).
2. O **primeiro login** no sistema vira **ADMINISTRADOR DO SISTEMA** automaticamente, com acesso a tudo.

### 3. Publicar no GitHub Pages
1. Crie um repositório no GitHub (por exemplo `praes-vendas`). Ele pode ser privado se o seu plano permitir Pages privado; senão, use público.
2. Envie **todos os arquivos desta pasta**, mantendo as subpastas `css`, `js`, `img` e `data`.
3. No repositório, abra **Settings › Pages**:
   - Source: **Deploy from a branch**.
   - Branch: **main**, pasta **/(root)**.
   - Clique em **Save**.
4. Depois de 1 ou 2 minutos, o link fica disponível, no formato `https://SEU-USUARIO.github.io/praes-vendas/`.
5. No Firebase, abra **Authentication › Configurações › Domínios autorizados › Adicionar domínio** e adicione `SEU-USUARIO.github.io`.

> Alternativa: o Firebase Hosting também funciona (`firebase deploy`), porque o arquivo `firebase.json` já está pronto.

### 4. Primeiro acesso
1. Entre com **fag** e a senha que você criou.
2. Vá em **Importar / Exportar › Carregar base inicial**. Isso grava:
   - as 239 vendas da planilha A3 GERAL;
   - 61 pessoas, com a hierarquia montada a partir das colunas CORRETOR › EQUIPE › DIRETORIA;
   - 18 regras do quadro de taxas;
   - 12 empreendimentos.
3. Vá em **Usuários › Novo usuário** e crie o **Guigão** com o e-mail dele, papel **Master**, vinculado à pessoa **GUIGÃO**. A foto da tela de login já entra automaticamente.
   - Deixe a **senha em branco**: o Firebase envia um e-mail para ele criar a própria senha.
4. Crie os logins dos gerentes e corretores, vincule cada um à **pessoa** do cadastro (mesmo nome usado nas vendas) e marque os **empreendimentos** que cada um pode ver.
5. Cada usuário pode trocar a **própria senha e foto** em **Meu perfil**. Se esquecer a senha, usa **"Esqueci minha senha"** na tela de login; o master também pode enviar o link pela tela de Usuários.
6. **Quer começar do zero?** Em **Dados › Zerar o banco de dados**, marque o que apagar (vendas, agendamentos, e se quiser corretores, empreendimentos e taxas), digite APAGAR e confirme. Um backup é baixado antes. Usuários não são apagados.

### 5. Ajustes recomendados logo no início
- **Regras de comissão:** na base recebida, quase nenhuma venda tem a regra preenchida.
  1. Em **Vendas**, filtre o empreendimento (por exemplo, UNNIA VERDÁ).
  2. Clique em **Aplicar regra em lote**.
  3. **Atenção:** MASKAN, REV3, VINX e outras incorporadoras **não estão no quadro de taxas** recebido. Cadastre essas regras em **Quadro de Taxas** primeiro.
- **Hierarquia:** confira em **Corretores / Equipe** se o gerente e o diretor de cada corretor estão certos. Eles foram montados automaticamente a partir das vendas.
- **Nomes duplicados:** CARBENET/CARBERNET viraram CABERNET, JACYNTHO/JACYNTO viraram JACINTHO e TAFFARELL virou TAFAREL. Se houver outros (por exemplo, WATANABE/YATANABE), use **Importar / Exportar › Renomear / juntar pessoa**.
- **Vendas sem data da venda:** os VENDIDO de 2026 vieram sem data da venda. O sistema usa a data do cadastro e marca a venda como pendência.

### Atualizar dados a partir do CRM (CV)
Continue exportando do CV para o Excel no **mesmo layout da aba BASE** e importe em **Importar / Exportar › Importar planilha**.
O sistema atualiza as vendas que já existem (mesmo CADASTRO + EMPREEND. + UNID.) e cria as novas.

---

## Estrutura dos arquivos
```
index.html              tela de login + sistema
css/style.css           visual
js/firebase-config.js   << cole aqui a configuração do seu Firebase
js/store.js             login, banco de dados (Firebase ou demonstração)
js/calc.js              regras de negócio (comissões, períodos, recebimentos)
js/app.js               telas
data/seed.js            base inicial tratada das planilhas
img/guigao.jpg          foto da tela de login
firestore.rules         regras de segurança do banco
firebase.json           (opcional) para Firebase Hosting
```

## Observações técnicas
- As fotos são reduzidas para 256 px e salvas no próprio cadastro do usuário. Não é preciso ativar o Firebase Storage, que hoje exige o plano pago.
- O plano gratuito do Firebase (Spark) atende com folga esse volume de dados.
- **Senha esquecida:** "Esqueci minha senha" envia o link de redefinição do próprio Firebase para o e-mail cadastrado (grátis).
- **Quadro de taxas:** conferido com a foto do quadro. Ajustes feitos: Verdá Base com Comercial 0,10%; Verdá Prêmio (7%) com Comercial e Secretaria 0,10% e PRAES 1,09%; Verdá Parcerias/Gerente de Parcerias com prêmio 1% = taxa 6,5% e prêmio 2% = 7,5%; Natury PF corretor 2,70%; nova regra GNG + PRÊMIO (5,8%, corretor 3,0%). Todas as regras agora fecham: soma dos cargos = taxa.
