const fs = require("fs");
const p = "src/components/ledger/transaction-form-dialog.tsx";
let s = fs.readFileSync(p, "utf8");
const before = s;

// Vencimento marcado como "mexido pelo usuario" para parar de seguir a competencia.
s = s.replace(
  `                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}`,
  `                  value={dueDate}
                  onChange={(e) => {
                    setDueTouched(true);
                    setDueDate(e.target.value);
                  }}`
);

// A competencia arrasta o vencimento junto ate alguem mexer nele.
s = s.replace(
  `                  value={date}
                  onChange={(e) => setDate(e.target.value)}`,
  `                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    if (!dueTouched) setDueDate(e.target.value);
                  }}`
);

if (s === before) { console.log("NADA MUDOU"); process.exit(1); }
fs.writeFileSync(p, s);
console.log("handlers ajustados");
