import { Injectable, Logger } from '@nestjs/common';
import { isDevEnv } from '../config/configuration';

export interface OutboxMail {
  to: string;
  subject: string;
  html: string;
  link?: string;
  replyTo?: string;
  at: string;
}

const BRAND = '#6c5ae6';

/** Escapa texto vindo do usuário antes de entrar no HTML do e-mail. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function layout(title: string, body: string, cta?: { label: string; url: string }) {
  const url = cta ? escapeHtml(cta.url) : '';
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#fbf8ff;padding:24px">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:24px;padding:32px;border:1px solid #ece6f7">
      <div style="font-size:28px;font-weight:900;color:#2d2640">Skedulei <span style="color:#e8689f">💜</span></div>
      <h2 style="color:#2d2640;margin:24px 0 8px">${title}</h2>
      <div style="color:#4a4360;font-size:15px;line-height:1.6">${body}</div>
      ${
        cta
          ? `<p style="margin:28px 0"><a href="${url}" style="background:${BRAND};color:#fff;padding:14px 26px;border-radius:16px;text-decoration:none;font-weight:700;display:inline-block">${cta.label}</a></p>
             <p style="color:#8a83a0;font-size:12px">Se o botão não funcionar, copie este link no navegador:<br/>${url}</p>`
          : ''
      }
    </div>
  </div>`;
}

/**
 * E-mail transacional via Resend (RESEND_API_KEY). Sem chave, nada sai: o e-mail fica numa
 * caixa de saída em memória (só fora de produção) e o link aparece no log — útil em desenvolvimento.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly outbox: OutboxMail[] = [];

  get enabled() {
    return !!process.env.RESEND_API_KEY;
  }

  recent(): OutboxMail[] {
    return [...this.outbox].reverse();
  }

  async send(mail: { to: string; subject: string; html: string; link?: string; replyTo?: string }): Promise<boolean> {
    if (!this.enabled) {
      // O link carrega um token de uso único: só aparece fora de produção.
      if (isDevEnv()) {
        this.outbox.push({ ...mail, at: new Date().toISOString() });
        if (this.outbox.length > 30) this.outbox.shift();
        this.logger.warn(`RESEND_API_KEY ausente — "${mail.subject}" não enviado.${mail.link ? ` Link: ${mail.link}` : ''}`);
      } else {
        this.logger.error(`RESEND_API_KEY ausente — e-mail "${mail.subject}" não enviado (configure o Resend)`);
      }
      return false;
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.MAIL_FROM ?? 'Skedulei <onboarding@resend.dev>',
          to: mail.to,
          subject: mail.subject,
          html: mail.html,
          ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      return true;
    } catch (err) {
      this.logger.error(`Falha ao enviar "${mail.subject}": ${(err as Error).message}`);
      return false;
    }
  }

  sendVerification(to: string, name: string, url: string) {
    return this.send({
      to,
      link: url,
      subject: 'Confirme seu e-mail no Skedulei',
      html: layout(
        `Oi, ${escapeHtml(name.split(' ')[0])}! 👋`,
        'Falta só confirmar que este e-mail é seu. É rapidinho:',
        { label: 'Confirmar e-mail', url },
      ),
    });
  }

  sendPasswordReset(to: string, url: string) {
    return this.send({
      to,
      link: url,
      subject: 'Redefinir sua senha do Skedulei',
      html: layout(
        'Vamos criar uma senha nova',
        'Recebemos um pedido para redefinir a senha da sua conta. O link vale por 1 hora. Se não foi você, é só ignorar — nada muda.',
        { label: 'Criar nova senha', url },
      ),
    });
  }

  /** Mensagem de contato (formulário público). Texto do usuário sempre escapado. */
  sendContact(to: string, name: string, email: string, message: string) {
    return this.send({
      to,
      replyTo: email,
      subject: `[Skedulei] Contato de ${name.replace(/[\r\n\[\]]/g, ' ')}`,
      html: layout(
        'Mensagem de contato',
        `<p><strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}) escreveu:</p><p style="white-space:pre-line">${escapeHtml(message)}</p>`,
      ),
    });
  }

  /** Confirmação do agendamento online, com o link para ver/cancelar. Textos do negócio escapados. */
  sendBookingConfirmation(to: string, p: { clientName: string; orgName: string; serviceName: string; professionalName: string; when: string; url: string }) {
    return this.send({
      to,
      link: p.url,
      subject: `Horário marcado em ${p.orgName.replace(/[\r\n]/g, ' ')}`,
      html: layout(
        `Tudo certo, ${escapeHtml(p.clientName.split(' ')[0])}! ✨`,
        `<strong>${escapeHtml(p.serviceName)}</strong> com ${escapeHtml(p.professionalName)} em <strong>${escapeHtml(p.orgName)}</strong>, ${escapeHtml(p.when)}.`,
        { label: 'Ver ou cancelar', url: p.url },
      ),
    });
  }

  /** Convite para a equipe de um negócio. Nomes vêm do usuário: escapados. */
  sendInvite(to: string, orgName: string, inviterName: string, roleLabel: string, url: string) {
    return this.send({
      to,
      link: url,
      subject: `Convite para a equipe de ${orgName.replace(/[\r\n]/g, ' ')} no Skedulei`,
      html: layout(
        'Você foi convidado(a) para a equipe 🎉',
        `<strong>${escapeHtml(inviterName)}</strong> convidou você para entrar em <strong>${escapeHtml(orgName)}</strong> como <strong>${escapeHtml(roleLabel)}</strong>. O convite vale por 7 dias.`,
        { label: 'Aceitar convite', url },
      ),
    });
  }

  sendExistingAccount(to: string, loginUrl: string) {
    return this.send({
      to,
      link: loginUrl,
      subject: 'Você já tem conta no Skedulei',
      html: layout('Você já tem uma conta 🙂', 'Alguém (talvez você) tentou se cadastrar com este e-mail. É só entrar — ou recuperar a senha se esqueceu.', {
        label: 'Entrar',
        url: loginUrl,
      }),
    });
  }
}
