/** Negócio ativo falso para os testes de componente: mexa em `orgState` antes de renderizar. */
const defaults = () => ({
  org: { id: 'o1', name: 'Studio Ana', timezone: 'America/Sao_Paulo', me: { memberId: 'm1' }, loyalty: { enabled: false, redeemPoints: 100, redeemValueCents: 500 } } as Record<string, unknown>,
  features: [] as string[],
  permissions: [] as string[],
  vocab: { client: 'Cliente', service: 'Serviço', clients: 'Clientes', services: 'Serviços', appointment: 'Agendamento' } as Record<string, string>,
});

export const orgState = defaults();

export function resetOrg() {
  Object.assign(orgState, defaults());
}

export function useOrg() {
  return {
    org: orgState.org,
    vocab: orgState.vocab,
    has: (f: string) => orgState.features.includes(f),
    can: (p: string) => orgState.permissions.includes(p),
  };
}
