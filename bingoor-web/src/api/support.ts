import { api } from '../lib/client';
import * as n from '../lib/normalize';
import { Ticket } from '../lib/types';

/** "Chat with customer care": the customer's side of the conversation. */
export const fetchMyTickets = async (): Promise<Ticket[]> => {
  const { data } = await api.get('/me/tickets');
  return (data.data as Record<string, unknown>[]).map(n.ticket);
};

/** Admin replies the customer has not opened - the number on the menu. */
export const fetchUnreadCount = async (): Promise<number> => {
  const { data } = await api.get('/me/tickets/unread');
  return (data.data as { count: number }).count;
};

export const fetchTicket = async (id: string): Promise<Ticket> => {
  const { data } = await api.get(`/me/tickets/${id}`);
  return n.ticket(data.data);
};

export const startChat = async (query: string, phone: string): Promise<{ ticket: Ticket; message: string }> => {
  const { data } = await api.post('/me/tickets', { query, phone });
  const payload = data.data as { ticket: Record<string, unknown>; message: string };
  return { ticket: n.ticket(payload.ticket), message: payload.message };
};

export const sendMessage = async (id: string, text: string): Promise<Ticket> => {
  const { data } = await api.post(`/me/tickets/${id}/messages`, { text });
  return n.ticket(data.data);
};

export type EnquiryKind = 'city_manager' | 'invest' | 'delivery_partner' | 'seller' | 'advertise' | 'complaint';

/** One of the six website contact forms; the team reads these in the admin panel. */
export const sendEnquiry = async (body: {
  kind: EnquiryKind;
  fullName: string;
  email: string;
  mobile: string;
  otherPhone?: string;
  reason: string;
}): Promise<string> => {
  const { data } = await api.post('/enquiries', body);
  return (data.data as { message: string }).message;
};

export interface WarehouseRegistration {
  name: string;
  phone: string;
  email?: string;
  password: string;
  shopName: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
  location: { lat: number; lng: number };
  gst?: string;
  note?: string;
}

/** A warehouse registering itself; it can log in to its panel once the admin approves. */
export const registerWarehouse = async (body: WarehouseRegistration): Promise<string> => {
  const { data } = await api.post('/seller/register', body);
  return (data.data as { message: string }).message;
};
