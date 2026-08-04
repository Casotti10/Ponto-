/**
 * Bandeira do Brasil animada
 * Criada por @lucascasotti
 */
export function AnimatedBrazilianFlag() {
  return (
    <svg
      width="48"
      height="32"
      viewBox="0 0 900 600"
      className="animate-wave"
      style={{
        animation: "wave 1.5s ease-in-out infinite",
      }}
    >
      {/* Fundo verde */}
      <rect width="900" height="600" fill="#009c3b" />

      {/* Losango amarelo */}
      <polygon points="450,150 750,300 450,450 150,300" fill="#ffcc00" />

      {/* Círculo azul */}
      <circle cx="450" cy="300" r="100" fill="#002776" />

      {/* Faixa branca */}
      <ellipse cx="450" cy="300" rx="95" ry="20" fill="white" />

      {/* Texto "Ordem e Progresso" */}
      <text
        x="450"
        y="310"
        textAnchor="middle"
        fill="#009c3b"
        fontSize="18"
        fontWeight="bold"
        fontFamily="serif"
      >
        Ordem e Progresso
      </text>

      <style>{`
        @keyframes wave {
          0%, 100% {
            transform: scaleX(1);
          }
          50% {
            transform: scaleX(1.08);
          }
        }
      `}</style>
    </svg>
  );
}
