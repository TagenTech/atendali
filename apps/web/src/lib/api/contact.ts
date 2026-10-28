import { api } from './client';

export interface ContactRequest {
  name: string;
  email: string;
  message: string;
}

export const sendContact = (body: ContactRequest) =>
  api<{ ok: true }>('/contact', { method: 'POST', body: JSON.stringify(body) });
