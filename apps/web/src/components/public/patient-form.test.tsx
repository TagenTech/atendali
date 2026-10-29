import { GUARDIAN_RELATIONSHIPS } from '@skedulei/contracts';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PatientForm } from './patient-form';

function show(props: Partial<React.ComponentProps<typeof PatientForm>> = {}) {
  const onSubmit = vi.fn();
  render(<PatientForm clientWord="Cliente" today="2026-10-28" saving={false} error={null} onSubmit={onSubmit} {...props} />);
  return onSubmit;
}
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const send = (name = 'Confirmar agendamento') => fireEvent.click(screen.getByRole('button', { name }));
const alert = () => screen.queryByRole('alert')?.textContent;
const radio = (name: string | RegExp) => fireEvent.click(screen.getByRole('radio', { name }));

describe('PatientForm', () => {
  it('começa "para mim", com os campos de quem marca', () => {
    show();
    expect(screen.getByRole('radio', { name: 'Para mim' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByLabelText('Seu nome')).toBeTruthy();
    expect(screen.queryByLabelText(/Nome da pessoa atendida/)).toBeNull();
  });

  it('valida nome e celular, um de cada vez, sem enviar', () => {
    const onSubmit = show();
    send();
    expect(alert()).toBe('Informe seu nome');
    type('Seu nome', 'Maria');
    send();
    expect(alert()).toBe('Informe um celular válido, com DDD');
    type('Celular (WhatsApp)', '1199');
    send();
    expect(alert()).toBe('Informe um celular válido, com DDD');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('envia para si mesma: e-mail em branco vira null', () => {
    const onSubmit = show();
    type('Seu nome', '  Maria Souza ');
    type('Celular (WhatsApp)', '(11) 99999-8888');
    send();
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Maria Souza', phone: '11999998888', email: null });
    expect(alert()).toBeUndefined();
  });

  it('com e-mail, leva o e-mail sem espaços', () => {
    const onSubmit = show();
    type('Seu nome', 'Maria');
    type('Celular (WhatsApp)', '11999998888');
    type(/E-mail/, ' maria@x.com ');
    send();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ email: 'maria@x.com' }));
  });

  it('para outra pessoa: pede o nome de quem será atendida e leva o parentesco', () => {
    const onSubmit = show();
    radio('Para outra pessoa');
    expect(screen.getByLabelText('Seu nome (quem está marcando)')).toBeTruthy();
    send();
    expect(alert()).toBe('Informe o nome da pessoa que será atendida');
    type('Nome da pessoa atendida', 'Pedrinho');
    type('Seu nome (quem está marcando)', 'Ana');
    type('Celular (WhatsApp)', '11988887777');
    type('Nascimento (opcional)', '2018-03-04');
    type('Seu parentesco', GUARDIAN_RELATIONSHIPS[0]);
    send();
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Ana',
      phone: '11988887777',
      email: null,
      patientName: 'Pedrinho',
      patientBirthDate: '2018-03-04',
      relationship: GUARDIAN_RELATIONSHIPS[0],
    });
  });

  it('para outra pessoa sem nascimento nem parentesco: vão como null', () => {
    const onSubmit = show();
    radio('Para outra pessoa');
    type('Nome da pessoa atendida', 'Pedrinho');
    type('Seu nome (quem está marcando)', 'Ana');
    type('Celular (WhatsApp)', '11988887777');
    send();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ patientBirthDate: null, relationship: null }));
  });

  it('em clínica o texto fala em paciente; voltar para "para mim" esconde os campos', () => {
    show({ clientWord: 'Paciente' });
    radio(/Para outro paciente/);
    send();
    expect(alert()).toBe('Informe o nome do paciente');
    expect(screen.getByLabelText('Nome do paciente')).toBeTruthy();
    radio('Para mim');
    expect(screen.queryByLabelText('Nome do paciente')).toBeNull();
  });

  it('mostra o erro de fora (ex.: API) e o erro local vence', () => {
    show({ error: 'Esse horário acabou de ser ocupado' });
    expect(alert()).toBe('Esse horário acabou de ser ocupado');
    send();
    expect(alert()).toBe('Informe seu nome');
  });

  it('texto do botão personalizado e travado enquanto envia', () => {
    show({ submitLabel: 'Confirmar 2 procedimentos', saving: true });
    expect((screen.getByRole('button', { name: 'Confirmar 2 procedimentos' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('sem "hoje" (ainda carregando) o nascimento não tem limite', () => {
    show({ today: null });
    radio('Para outra pessoa');
    expect(screen.getByLabelText('Nascimento (opcional)').getAttribute('max')).toBeNull();
  });
});
