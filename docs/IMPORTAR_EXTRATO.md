# Importar extrato bancário

Traz os gastos do banco para o razão de `/financeiro` a partir do **extrato ou
da fatura que o próprio banco exporta** — OFX, CSV ou PDF. Cada lançamento entra
no mês da sua própria data, então o extrato de agosto alimenta agosto e o de
setembro alimenta setembro.

**Ordem de preferência: OFX → CSV → PDF.** O OFX traz um identificador único por
lançamento (`FITID`) e a importação vira exata. O PDF não tem estrutura de dados
nenhuma: é texto posicionado numa página, e ler lançamento dele é reconhecer
padrão de layout — que o banco muda sem avisar.

## Por que não conecta direto no banco

Acesso programático a conta bancária no Brasil passa por **Open Finance**, e
chamar as APIs dos bancos exige ser instituição autorizada pelo Banco Central,
registrada no diretório e com certificados mTLS. Pessoa física não obtém isso.
As alternativas seriam um agregador certificado (Pluggy, Belvo), que cobra e
exige cadastro, ou o extrato exportado — que é gratuito, não envolve entregar
senha de banco a ninguém e todo banco brasileiro oferece.

## Quem pode usar

Restrito por allowlist em [`src/lib/import-access.ts`](../src/lib/import-access.ts).
O padrão é só `lucascasotti1@gmail.com`. Para mudar sem alterar código, defina
`LEDGER_IMPORT_ALLOWLIST` (e-mails separados por vírgula) nas variáveis de
ambiente.

Quem não está na lista não vê o botão **Importar extrato** e recebe `403` na API.

## Onde baixar o extrato em cada banco

| Banco | Caminho | Formato |
|---|---|---|
| Nubank | Conta → ícone de recibo → *Exportar extrato* | OFX / CSV |
| Itaú | Extrato → *Salvar em outros formatos* → *OFX* | OFX |
| Bradesco | Extrato → *Exportar* → *OFX (Money 2000+)* | OFX |
| Banco do Brasil | Extrato → *Salvar* → *OFX* | OFX |
| Inter | Extrato → *Exportar* | OFX / CSV |
| C6 | Extrato → *Compartilhar* → *OFX* | OFX |
| Santander | Extrato → *Exportar* → *OFX* | OFX |
| Caixa | Extrato → *Salvar em outro formato* | OFX |

**Prefira OFX.** Ele traz o `FITID`, um identificador único por lançamento, e é
com ele que a importação garante não duplicar nada. CSV e PDF não têm
identificador, então a deduplicação usa uma impressão digital calculada do
próprio lançamento — funciona, mas é menos preciso.

## PDF

Existe porque vários bancos não oferecem OFX da **fatura do cartão**. Dois
layouts são reconhecidos, com graus de confiança bem diferentes:

| Layout | Estado |
|---|---|
| Extrato de conta do Nubank | **Verificado** contra um arquivo real: os totais de entrada e saída batem ao centavo com o que o próprio banco declara no documento (129 lançamentos, 0 descartados) |
| Fatura de cartão no padrão `DD/MM DESCRIÇÃO VALOR` (Santander, Itaú, Bradesco, BB) | **Não calibrado.** A lógica foi testada contra faturas sintéticas, mas nenhuma fatura real foi aberta durante o desenvolvimento — a que motivou o recurso é protegida por senha |

Se a sua fatura não for lida corretamente, o layout dela difere do padrão e
precisa de ajuste em `parseFatura`, em
[`src/lib/pdf-statement-parser.ts`](../src/lib/pdf-statement-parser.ts).

### Senha

Bancos costumam proteger a fatura em PDF (a do Santander usa RC4-128). Quando o
arquivo é protegido, a interface mostra um campo de senha — normalmente são
dígitos do CPF ou a data de nascimento. A senha é usada apenas para abrir o
documento naquela requisição: **não é gravada, não vai para log e não sobrevive
ao fechamento do diálogo.**

### O que o PDF não resolve

- **PDF digitalizado** (imagem, sem camada de texto) é recusado com mensagem
  clara. Não há OCR.
- Numa **fatura**, tudo é despesa por padrão. Pagamentos e estornos viram
  entrada, detectados pelo sufixo (`-`, `CR`, `C`) ou pela descrição.
- A fatura mostra a compra como `DD/MM`, sem ano. O ano sai do vencimento, do
  texto ou do nome do arquivo — numa fatura de janeiro, uma compra de 15/12 é do
  ano anterior.

## Usando pela tela

1. `/financeiro` → **Importar extrato**
2. Escolha a **conta de destino** e o arquivo
3. **Conferir extrato** — mostra, sem gravar nada:
   - quantos lançamentos são novos, quantos já foram importados antes e quantos
     podem colidir com algo digitado à mão
   - a distribuição por mês
   - a categoria que cada gasto vai receber
   - as linhas que não deram para ler
4. **Importar** grava.

Reimportar o mesmo arquivo é seguro: nada duplica.

## Usando pela API

`POST /api/financeiro/import` — `multipart/form-data`, autenticado pelo cookie
de sessão.

| Campo | Obrigatório | Descrição |
|---|---|---|
| `file` | sim | `.ofx`, `.csv`, `.txt` ou `.pdf`, até 5 MB |
| `accountId` | sim | conta de destino |
| `mode` | não | `preview` (padrão) ou `commit` |
| `includePossibleDuplicates` | não | `true` grava também o que casa com lançamento manual |
| `createMissingCategories` | não | `true` (padrão) cria as categorias sugeridas |
| `password` | não | senha do PDF, quando o banco protege o arquivo |

O formato é detectado pelo **conteúdo**, não pela extensão: um OFX salvo como
`.txt` e um PDF com qualquer nome são reconhecidos pelos bytes iniciais.

```bash
# Conferir sem gravar
curl -X POST https://<app>/api/financeiro/import \
  -H "Cookie: ponto_session=<token>" \
  -F "file=@extrato.ofx" \
  -F "accountId=<id-da-conta>" \
  -F "mode=preview"

# Gravar
curl -X POST https://<app>/api/financeiro/import \
  -H "Cookie: ponto_session=<token>" \
  -F "file=@extrato.ofx" \
  -F "accountId=<id-da-conta>" \
  -F "mode=commit"
```

`GET /api/financeiro/import` devolve os limites (formatos, tamanho máximo).

Códigos: `401` sem sessão · `403` fora da allowlist · `413` arquivo grande
demais · `422` arquivo ilegível, sem lançamentos aproveitáveis, ou PDF protegido
(a resposta traz `passwordRequired: true`).

## Como a duplicação é evitada

A coluna `Transaction.externalId` guarda a identidade do lançamento na origem,
com `@@unique([accountId, externalId])`:

- **OFX** → `ofx:<FITID>`, o id que o banco emitiu.
- **CSV e PDF** → `fp:<sha1(data|tipo|valor|descrição)>:<ocorrência>`. O contador de
  ocorrência distingue lançamentos legitimamente iguais no mesmo dia (dois cafés
  de R$ 5 no mesmo lugar entram os dois), e como ele é determinístico, reenviar o
  arquivo não gera chave nova.

Lançamentos digitados à mão têm `externalId` nulo — no Postgres nulos não colidem
entre si, então o cadastro manual não é afetado. Como eles não têm chave para
comparar, a importação sinaliza como **possível duplicado** o que bate em data,
valor e tipo, e deixa a decisão com você (por padrão, não importa).

## Categorização automática

Duas camadas, nesta ordem:

1. **Seu histórico.** Se você já classificou "PADARIA DO ZÉ" como Alimentação, a
   próxima importação repete a escolha. A comparação usa as três primeiras
   palavras da descrição, sem acento e sem números soltos, então parcela e data
   grudadas no nome não atrapalham.
2. **Dicionário de palavras-chave** (`CATEGORY_RULES` em
   [`src/lib/import-service.ts`](../src/lib/import-service.ts)) com os
   estabelecimentos brasileiros mais comuns. Vence a palavra-chave mais longa que
   casar — é o que faz "MERCADO LIVRE" cair em Compras e não em Alimentação.

O que nenhuma camada reconhecer entra sem categoria e aparece como "Sem
categoria" no gráfico de pizza.

## Migration

O recurso adiciona `externalId` e `importedAt` em `Transaction`
(`prisma/migrations/20260821143000_add_ledger_import`). O `buildCommand` do
`vercel.json` já roda `prisma migrate deploy`, então **a migration é aplicada no
próximo deploy**. Em banco local: `npx prisma migrate deploy`.

## Limites

- 5 MB por arquivo, 5.000 lançamentos por importação
- PDF digitalizado (sem camada de texto) não é lido — não há OCR
- Extrato muito longo: exporte em períodos menores
- Linhas ilegíveis são descartadas e listadas no preview, sem derrubar o resto
