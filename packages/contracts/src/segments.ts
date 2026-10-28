/**
 * Segmentos atendidos e os módulos que cada um liga por padrão.
 * O núcleo (agenda, clientes, serviços, financeiro) vale para todos; os módulos são opcionais.
 */

export const Segment = {
  SALAO_BELEZA: 'SALAO_BELEZA',
  BARBEARIA: 'BARBEARIA',
  ESTETICA: 'ESTETICA',
  CLINICA_MEDICA: 'CLINICA_MEDICA',
  ODONTOLOGIA: 'ODONTOLOGIA',
  TERAPIAS: 'TERAPIAS',
  OUTRO: 'OUTRO',
} as const;
export type Segment = (typeof Segment)[keyof typeof Segment];

/** Módulos que podem ser ligados/desligados por negócio. */
export const Feature = {
  COMISSOES: 'COMISSOES',
  ESTOQUE: 'ESTOQUE',
  PACOTES: 'PACOTES',
  ASSINATURAS: 'ASSINATURAS',
  SALAS: 'SALAS',
  EQUIPAMENTOS: 'EQUIPAMENTOS',
  ANAMNESE: 'ANAMNESE',
  FOTOS: 'FOTOS',
  TERMOS: 'TERMOS',
  PRONTUARIO: 'PRONTUARIO',
  TELECONSULTA: 'TELECONSULTA',
  CONVENIOS: 'CONVENIOS',
  VALES: 'VALES',
  FIDELIDADE: 'FIDELIDADE',
} as const;
export type Feature = (typeof Feature)[keyof typeof Feature];

export const FEATURE_INFO: Record<Feature, { label: string; description: string }> = {
  COMISSOES: { label: 'Comissões', description: 'Percentual ou valor por serviço e fechamento por profissional.' },
  ESTOQUE: { label: 'Estoque e produtos', description: 'Venda de produtos e baixa de insumos por atendimento.' },
  PACOTES: { label: 'Pacotes de sessões', description: 'Venda de N sessões com saldo e validade.' },
  ASSINATURAS: { label: 'Clube de assinatura', description: 'Planos mensais com cobrança recorrente.' },
  SALAS: { label: 'Salas e cadeiras', description: 'Agenda também por sala, maca ou cadeira.' },
  EQUIPAMENTOS: { label: 'Equipamentos', description: 'Evita dois atendimentos no mesmo aparelho ao mesmo tempo.' },
  ANAMNESE: { label: 'Fichas de anamnese', description: 'Formulários que o cliente preenche antes do atendimento.' },
  FOTOS: { label: 'Fotos antes e depois', description: 'Galeria privada por cliente, com comparação.' },
  TERMOS: { label: 'Termos de consentimento', description: 'Documentos assinados na tela ou pelo link.' },
  PRONTUARIO: { label: 'Prontuário', description: 'Evolução clínica, prescrição e atestado.' },
  TELECONSULTA: { label: 'Teleconsulta', description: 'Atendimento por vídeo com link.' },
  CONVENIOS: { label: 'Convênios', description: 'Planos de saúde e guias TISS.' },
  VALES: { label: 'Vale-presente', description: 'Venda de vales com código e saldo, usados como forma de pagamento.' },
  FIDELIDADE: { label: 'Programa de fidelidade', description: 'Pontos a cada compra, trocados por desconto.' },
};

/** Palavras que mudam por segmento ("Cliente" × "Paciente"). */
export interface Vocabulary {
  client: string;
  clients: string;
  service: string;
  services: string;
  appointment: string;
  appointments: string;
  professional: string;
  professionals: string;
}

export interface SampleService {
  name: string;
  category: string;
  durationMinutes: number;
  /** Centavos. */
  priceCents: number;
}

export interface SegmentPreset {
  label: string;
  description: string;
  /** Nome de ícone do lucide-react (resolvido no web). */
  icon: string;
  vocabulary: Vocabulary;
  features: Feature[];
  sampleServices: SampleService[];
}

const BEAUTY_VOCAB: Vocabulary = {
  client: 'Cliente',
  clients: 'Clientes',
  service: 'Serviço',
  services: 'Serviços',
  appointment: 'Agendamento',
  appointments: 'Agendamentos',
  professional: 'Profissional',
  professionals: 'Profissionais',
};

const HEALTH_VOCAB: Vocabulary = {
  client: 'Paciente',
  clients: 'Pacientes',
  service: 'Procedimento',
  services: 'Procedimentos',
  appointment: 'Consulta',
  appointments: 'Consultas',
  professional: 'Profissional',
  professionals: 'Profissionais',
};

export const SEGMENT_PRESETS: Record<Segment, SegmentPreset> = {
  SALAO_BELEZA: {
    label: 'Salão de beleza',
    description: 'Cabelo, unhas, maquiagem e sobrancelha.',
    icon: 'Scissors',
    vocabulary: BEAUTY_VOCAB,
    features: ['COMISSOES', 'ESTOQUE', 'PACOTES'],
    sampleServices: [
      { name: 'Corte feminino', category: 'Cabelo', durationMinutes: 60, priceCents: 9000 },
      { name: 'Escova', category: 'Cabelo', durationMinutes: 45, priceCents: 6000 },
      { name: 'Coloração', category: 'Cabelo', durationMinutes: 120, priceCents: 18000 },
      { name: 'Manicure', category: 'Unhas', durationMinutes: 45, priceCents: 4000 },
      { name: 'Pedicure', category: 'Unhas', durationMinutes: 50, priceCents: 4500 },
      { name: 'Design de sobrancelha', category: 'Sobrancelha', durationMinutes: 30, priceCents: 4000 },
    ],
  },
  BARBEARIA: {
    label: 'Barbearia',
    description: 'Corte, barba e cuidados masculinos.',
    icon: 'Brush',
    vocabulary: BEAUTY_VOCAB,
    features: ['COMISSOES', 'ESTOQUE', 'ASSINATURAS'],
    sampleServices: [
      { name: 'Corte', category: 'Cabelo', durationMinutes: 40, priceCents: 5000 },
      { name: 'Barba', category: 'Barba', durationMinutes: 30, priceCents: 3500 },
      { name: 'Corte + barba', category: 'Combo', durationMinutes: 60, priceCents: 8000 },
      { name: 'Pigmentação', category: 'Barba', durationMinutes: 30, priceCents: 4000 },
    ],
  },
  ESTETICA: {
    label: 'Clínica de estética',
    description: 'Procedimentos faciais, corporais e depilação.',
    icon: 'Sparkles',
    vocabulary: { ...BEAUTY_VOCAB, service: 'Procedimento', services: 'Procedimentos' },
    features: ['COMISSOES', 'ESTOQUE', 'PACOTES', 'SALAS', 'EQUIPAMENTOS', 'ANAMNESE', 'FOTOS', 'TERMOS'],
    sampleServices: [
      { name: 'Limpeza de pele', category: 'Facial', durationMinutes: 60, priceCents: 18000 },
      { name: 'Drenagem linfática', category: 'Corporal', durationMinutes: 60, priceCents: 15000 },
      { name: 'Depilação a laser (sessão)', category: 'Depilação', durationMinutes: 30, priceCents: 20000 },
      { name: 'Toxina botulínica', category: 'Injetáveis', durationMinutes: 45, priceCents: 120000 },
      { name: 'Avaliação', category: 'Avaliação', durationMinutes: 30, priceCents: 0 },
    ],
  },
  CLINICA_MEDICA: {
    label: 'Clínica médica',
    description: 'Consultórios e clínicas de uma ou várias especialidades.',
    icon: 'Stethoscope',
    vocabulary: HEALTH_VOCAB,
    features: ['SALAS', 'ANAMNESE', 'TERMOS', 'PRONTUARIO', 'TELECONSULTA'],
    sampleServices: [
      { name: 'Consulta', category: 'Consultas', durationMinutes: 30, priceCents: 30000 },
      { name: 'Retorno', category: 'Consultas', durationMinutes: 20, priceCents: 0 },
      { name: 'Teleconsulta', category: 'Consultas', durationMinutes: 30, priceCents: 25000 },
    ],
  },
  ODONTOLOGIA: {
    label: 'Odontologia',
    description: 'Consultórios e clínicas odontológicas.',
    icon: 'Smile',
    vocabulary: HEALTH_VOCAB,
    features: ['SALAS', 'ANAMNESE', 'FOTOS', 'TERMOS', 'PRONTUARIO', 'PACOTES'],
    sampleServices: [
      { name: 'Avaliação', category: 'Clínico geral', durationMinutes: 30, priceCents: 0 },
      { name: 'Limpeza (profilaxia)', category: 'Clínico geral', durationMinutes: 45, priceCents: 25000 },
      { name: 'Restauração', category: 'Dentística', durationMinutes: 60, priceCents: 30000 },
      { name: 'Clareamento', category: 'Estética', durationMinutes: 60, priceCents: 80000 },
    ],
  },
  TERAPIAS: {
    label: 'Terapias e bem-estar',
    description: 'Fisioterapia, psicologia, nutrição, massoterapia.',
    icon: 'HeartPulse',
    vocabulary: HEALTH_VOCAB,
    features: ['PACOTES', 'ANAMNESE', 'TERMOS', 'PRONTUARIO', 'TELECONSULTA'],
    sampleServices: [
      { name: 'Sessão', category: 'Sessões', durationMinutes: 50, priceCents: 18000 },
      { name: 'Avaliação inicial', category: 'Avaliação', durationMinutes: 60, priceCents: 20000 },
      { name: 'Massagem relaxante', category: 'Massoterapia', durationMinutes: 60, priceCents: 15000 },
    ],
  },
  OUTRO: {
    label: 'Outro tipo de negócio',
    description: 'Qualquer serviço com hora marcada.',
    icon: 'CalendarClock',
    vocabulary: BEAUTY_VOCAB,
    features: [],
    sampleServices: [{ name: 'Atendimento', category: 'Geral', durationMinutes: 60, priceCents: 10000 }],
  },
};

export const SEGMENTS = Object.keys(SEGMENT_PRESETS) as Segment[];
export const FEATURES = Object.keys(FEATURE_INFO) as Feature[];

/** Módulos que guardam dado de saúde (LGPD art. 11): exigem cuidado extra de acesso. */
export const HEALTH_FEATURES: readonly Feature[] = ['ANAMNESE', 'FOTOS', 'PRONTUARIO', 'TELECONSULTA', 'CONVENIOS'];

export function vocabularyFor(segment: Segment): Vocabulary {
  return SEGMENT_PRESETS[segment].vocabulary;
}

/** Mantém só módulos conhecidos, sem repetição e na ordem do catálogo. */
export function normalizeFeatures(list: readonly string[]): Feature[] {
  const set = new Set(list);
  return FEATURES.filter((f) => set.has(f));
}
