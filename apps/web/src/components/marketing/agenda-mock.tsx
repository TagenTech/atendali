import { CheckCircle2, Globe } from 'lucide-react';

type Block = { col: number; at: number; min: number; name: string; what: string; tone: 'open' | 'confirmed' | 'arrived' | 'done'; online?: boolean };

const START = 8;
const HOURS = 5;
const PX_PER_HOUR = 68;

const PROS = [
  { name: 'Helena', color: 1 },
  { name: 'Marcos', color: 3 },
  { name: 'Tatiane', color: 4 },
];

const BLOCKS: Block[] = [
  { col: 0, at: 8.5, min: 45, name: 'Ana Souza', what: 'Consulta', tone: 'done' },
  { col: 0, at: 10, min: 30, name: 'Paulo Ribeiro', what: 'Retorno', tone: 'confirmed' },
  { col: 0, at: 11.5, min: 60, name: 'Camila Dias', what: 'Consulta', tone: 'open', online: true },
  { col: 1, at: 8, min: 60, name: 'Luiza Prado', what: 'Avaliação', tone: 'done' },
  { col: 1, at: 9.5, min: 45, name: 'Rafael Costa', what: 'Consulta', tone: 'arrived' },
  { col: 1, at: 11, min: 30, name: 'Bruna Reis', what: 'Retorno', tone: 'open', online: true },
  { col: 2, at: 9, min: 90, name: 'Marta Lima', what: 'Procedimento', tone: 'confirmed' },
  { col: 2, at: 11, min: 45, name: 'Jorge Alves', what: 'Consulta', tone: 'open' },
  { col: 2, at: 12, min: 60, name: 'Sofia Nunes', what: 'Consulta', tone: 'confirmed', online: true },
];

const TONE: Record<Block['tone'], string> = {
  open: '',
  confirmed: '',
  arrived: 'bg-warning-soft text-warning-soft-foreground',
  done: 'bg-success-soft text-success-soft-foreground',
};

const NOW = 10.33;
const top = (h: number) => (h - START) * PX_PER_HOUR;

/**
 * Ilustração da agenda do Skedulei (dados fictícios): mesma linguagem visual da grade real — coluna por profissional,
 * barra lateral na cor de quem atende, linha âmbar de "agora". Decorativa: o texto da página já descreve o recurso.
 */
export function AgendaMock({ className }: { className?: string }) {
  return (
    <div className={className} role="img" aria-label="Exemplo ilustrativo da agenda do dia com três profissionais e horários marcados">
      <div className="overflow-hidden rounded-3xl border border-border bg-card" aria-hidden>
        <div className="flex items-end justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">9 horários</p>
            <p className="font-display text-lg font-extrabold leading-tight">Hoje</p>
          </div>
          <div className="flex rounded-2xl border border-input p-0.5">
            <span className="h-8 rounded-xl bg-foreground px-3 text-sm font-bold leading-8 text-background">dia</span>
            <span className="h-8 rounded-xl px-3 text-sm font-bold leading-8 text-muted-foreground">semana</span>
          </div>
        </div>
        <div className="flex border-b border-border">
          <div className="w-12 shrink-0" />
          {PROS.map((p, ci) => (
            <div key={p.name} className={`flex flex-1 items-center gap-2 border-l border-border px-3 py-2 ${ci === 2 ? 'hidden sm:flex' : ''}`}>
              <span className="size-2.5 rounded-full" style={{ background: `var(--pro-${p.color}-fg)` }} />
              <span className="truncate text-sm font-bold">{p.name}</span>
            </div>
          ))}
        </div>
        <div className="relative flex" style={{ height: HOURS * PX_PER_HOUR }}>
          <div className="relative w-12 shrink-0">
            {Array.from({ length: HOURS }, (_, i) => (
              <span key={i} className="absolute right-2 text-xs font-semibold text-muted-foreground" style={{ top: Math.max(2, i * PX_PER_HOUR - 7) }}>
                {String(START + i).padStart(2, '0')}:00
              </span>
            ))}
          </div>
          {PROS.map((p, ci) => (
            <div key={p.name} className={`relative min-w-0 flex-1 border-l border-border ${ci === 2 ? 'hidden sm:block' : ''}`}>
              {Array.from({ length: HOURS }, (_, i) => (
                <div key={i} className="absolute inset-x-0 border-t border-border/70" style={{ top: i * PX_PER_HOUR }} />
              ))}
              {BLOCKS.filter((b) => b.col === ci).map((b) => (
                <div
                  key={b.name}
                  className={`absolute inset-x-1 overflow-hidden rounded-lg border-l-[3px] border-l-current px-2 py-1 text-[13px] leading-tight ${TONE[b.tone]}`}
                  style={{
                    top: top(b.at) + 1,
                    height: (b.min / 60) * PX_PER_HOUR - 2,
                    ...(b.tone === 'open' || b.tone === 'confirmed' ? { background: `var(--pro-${p.color})`, color: `var(--pro-${p.color}-fg)` } : {}),
                  }}
                >
                  <span className="flex items-center gap-1 font-bold">
                    <span>{`${String(Math.floor(b.at)).padStart(2, '0')}:${b.at % 1 ? '30' : '00'}`}</span>
                    <span className="truncate">{b.name}</span>
                    {b.tone === 'confirmed' ? <CheckCircle2 className="size-3.5 shrink-0" /> : null}
                    {b.online ? <Globe className="size-3.5 shrink-0 opacity-70" /> : null}
                  </span>
                  {b.min >= 45 ? <span className="block truncate opacity-80">{b.what}</span> : null}
                </div>
              ))}
            </div>
          ))}
          <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: top(NOW) }}>
            <span className="ml-1 rounded bg-pink px-1.5 py-0.5 text-[11px] font-bold text-white">10:20</span>
            <span className="h-0.5 flex-1 bg-pink" />
          </div>
        </div>
      </div>
    </div>
  );
}
