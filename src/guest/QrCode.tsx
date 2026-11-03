import { useMemo } from 'react';
import QRCode from 'qrcode';

/**
 * QR em SVG (nítido em qualquer tamanho e ao imprimir), com correção de erros alta
 * para continuar legível com o ecrã riscado, reflexos ou pouco brilho.
 */
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const { size, path } = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: 'H' });
    const n = qr.modules.size;
    const data = qr.modules.data;
    let d = '';
    // Um retângulo por cada sequência horizontal de módulos escuros.
    for (let y = 0; y < n; y++) {
      let x = 0;
      while (x < n) {
        if (!data[y * n + x]) { x++; continue; }
        const start = x;
        while (x < n && data[y * n + x]) x++;
        d += `M${start} ${y}h${x - start}v1h${start - x}z`;
      }
    }
    return { size: n, path: d };
  }, [value]);

  // Zona de silêncio de 4 módulos, como pede a norma.
  const q = 4;
  return (
    <svg
      className={className}
      viewBox={`${-q} ${-q} ${size + 2 * q} ${size + 2 * q}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect x={-q} y={-q} width={size + 2 * q} height={size + 2 * q} fill="#fff" />
      <path d={path} fill="#0b1220" />
    </svg>
  );
}
