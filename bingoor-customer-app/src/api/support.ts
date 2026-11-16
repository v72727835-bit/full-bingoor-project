import type { ApiEnvelope, FestivalPage, Notice, PublicSettings, Ticket } from '../types';
import { api } from './client';

/** The festival tab: the admin's banner and the aisle rows behind it. */
export async function fetchFestival(): Promise<FestivalPage> {
  const { data } = await api.get<ApiEnvelope<FestivalPage>>('/festival');
  return data.data;
}

/** Shop-wide switches: the festival tab's name, the store links, the COD note. */
export async function fetchPublicSettings(): Promise<PublicSettings> {
  const { data } = await api.get<ApiEnvelope<PublicSettings>>('/settings/public');
  return data.data;
}

/** Announcements, newest first - what the bell shows. */
export async function fetchNotices(): Promise<Notice[]> {
  const { data } = await api.get<ApiEnvelope<Notice[]>>('/notices');
  return data.data;
}

/** "Notify me" on an out-of-stock product. Returns the line to show back. */
export async function notifyWhenBack(productId: string, phone: string): Promise<string> {
  const { data } = await api.post<ApiEnvelope<{ message: string }>>(
    `/products/${productId}/notify`,
    { phone },
  );
  return data.data.message;
}

/* --------------------------- chat with customer care --------------------- */

export async function fetchMyTickets(): Promise<Ticket[]> {
  const { data } = await api.get<ApiEnvelope<Ticket[]>>('/me/tickets');
  return data.data;
}

/** Replies the team has sent that the customer has not opened yet. */
export async function fetchCareUnread(): Promise<number> {
  const { data } = await api.get<ApiEnvelope<{ count: number }>>('/me/tickets/unread');
  return data.data.count;
}

export async function fetchTicket(id: string): Promise<Ticket> {
  const { data } = await api.get<ApiEnvelope<Ticket>>(`/me/tickets/${id}`);
  return data.data;
}

export async function startChat(
  query: string,
  phone: string,
): Promise<{ ticket: Ticket; message: string }> {
  const { data } = await api.post<ApiEnvelope<{ ticket: Ticket; message: string }>>('/me/tickets', {
    query,
    phone,
  });
  return data.data;
}

export async function replyToTicket(id: string, text: string): Promise<Ticket> {
  const { data } = await api.post<ApiEnvelope<Ticket>>(`/me/tickets/${id}/messages`, { text });
  return data.data;
}
